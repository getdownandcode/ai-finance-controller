"""Shared reconciliation pipeline — autonomous, goal-driven, policy-bounded."""
from __future__ import annotations

import logging
from pathlib import Path

import pandas as pd
from fastapi import HTTPException

from agents.autonomous_controller import AutonomousController
from agents.controller_agent import AgentConfig
from agents.reporting_agent import ReportingAgent
from config.policy_loader import Policy
from evaluation.score import evaluate
from tools.cash_position import cash_position
from tools.normalize import Record, parse_records_from_dataframe

log = logging.getLogger(__name__)


def _parse_df(df: pd.DataFrame | None, source: str) -> list[Record]:
    if df is None or df.empty:
        return []
    return parse_records_from_dataframe(df, source)


def _build_gt_map(gt_df: pd.DataFrame | None, all_records: dict[str, Record]) -> dict[str, str] | None:
    if gt_df is None or gt_df.empty:
        return None
    try:
        cols = {str(c).lower().strip(): c for c in gt_df.columns}
        rec_col = cols.get("record_id", cols.get("id"))
        grp_col = cols.get("group_id", cols.get("group"))
        if not rec_col or not grp_col:
            return None
        gt_map = {str(r[rec_col]).strip(): str(r[grp_col]).strip() for _, r in gt_df.iterrows()}
        if gt_map:
            extra = {}
            for rid in list(all_records.keys()):
                if ":" in rid:
                    base = rid.split(":", 1)[1].split("#", 1)[0]
                    if base in gt_map and rid not in gt_map:
                        extra[rid] = gt_map[base]
            if extra:
                gt_map.update(extra)
                log.info("Extended GT map with %d namespaced IDs", len(extra))
        return gt_map
    except Exception:
        log.exception("Failed to parse ground truth mapping")
        return None


def run_reconciliation(
    bank_df: pd.DataFrame | None = None,
    ledger_df: pd.DataFrame | None = None,
    invoices_df: pd.DataFrame | None = None,
    gt_df: pd.DataFrame | None = None,
    *,
    sources: list[dict] | None = None,
    bank_opening: float = 42500.0,
    ledger_opening: float = 42500.0,
    llm_mode: str = "auto",
    batch_id: str = "custom_run",
    reports_dir: Path = Path("reports"),
    goal: str = "reconcile",
    policy_path: str | Path | None = None,
    mode: str | None = None,
    progress_callback=None,
    **kwargs,
) -> dict:
    """Autonomous pipeline: goal → observe → plan → act → reflect until complete or blocked."""
    def _progress(stage: str, percent: int, message: str = "") -> None:
        try:
            if progress_callback is not None:
                progress_callback(stage, percent, message)
        except Exception:
            pass
    if mode == "fixed":
        log.warning("mode='fixed' is deprecated and ignored — running autonomous pipeline")

    if sources is None:
        sources = [
            {"df": bank_df, "category": "bank", "label": "Bank Feed", "opening_balance": bank_opening, "source_key": "bank"},
            {"df": ledger_df, "category": "ledger", "label": "General Ledger", "opening_balance": ledger_opening, "source_key": "ledger"},
            {"df": invoices_df, "category": "invoice", "label": "Invoices", "opening_balance": 0.0, "source_key": "invoice"},
        ]

    # Filter out empty entries
    active_sources = [s for s in sources if s.get("df") is not None and not s["df"].empty]

    _progress("normalizing", 8, "Normalizing schemas across sources")

    all_records: dict[str, Record] = {}
    source_counts: dict[str, int] = {}
    accounts_meta: list[dict] = []
    total_bank_opening = 0.0
    total_ledger_opening = 0.0

    for s in active_sources:
        df = s["df"]
        cat = str(s.get("category", "bank")).lower().strip()
        label = str(s.get("label") or cat).strip()
        src_key = str(s.get("source_key") or f"{cat}:{label.lower().replace(' ', '_')}").strip()
        op_bal = float(s.get("opening_balance", 0.0) or 0.0)

        if cat == "bank" or cat.startswith("bank:") or cat.startswith("gateway:") or cat.startswith("card:"):
            total_bank_opening += op_bal
        elif cat == "ledger" or cat.startswith("ledger:"):
            total_ledger_opening += op_bal

        accounts_meta.append({
            "label": label,
            "category": cat,
            "source_key": src_key,
            "opening_balance": op_bal,
        })

        parsed_recs = _parse_df(df, src_key)
        source_counts[label] = len(parsed_recs)

        for r in parsed_recs:
            if r.record_id in all_records:
                existing = all_records[r.record_id]
                if existing.source == r.source:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Duplicate record_id '{r.record_id}' inside {label} ({r.source}) — each row needs a unique ID. Check for repeated '{r.record_id}' in your CSV.",
                    )
                new_id = f"{r.source}:{r.record_id}"
                counter = 1
                while new_id in all_records:
                    counter += 1
                    new_id = f"{r.source}:{r.record_id}#{counter}"
                log.warning("Cross-source duplicate ID '%s' (sources %s vs %s) — auto-renamed to '%s'",
                            r.record_id, existing.source, r.source, new_id)
                r.record_id = new_id
            all_records[r.record_id] = r

    if not all_records:
        raise HTTPException(status_code=400, detail="No valid records could be parsed from the provided files.")

    if len(all_records) > 10000:
        log.warning("Large batch: %d records (check MAX_RECORDS)", len(all_records))

    meta = {
        "batch_id": batch_id,
        "opening_balances": {"bank": total_bank_opening, "ledger": total_ledger_opening},
        "accounts": accounts_meta,
    }
    cfg = AgentConfig(llm_mode=llm_mode)
    policy = Policy.load(policy_path)

    _progress("candidates", 25, "Finding candidate pairs")
    controller = AutonomousController(all_records, meta, policy=policy, goal=goal, cfg=cfg)
    _progress("matching", 40, "Executing multi-tier matching rules")
    autonomous_state = controller.run()
    recon_state = autonomous_state.recon

    _progress("evaluating", 70, "Evaluating AI evidence and scoring")
    gt_map = _build_gt_map(gt_df, all_records)
    metrics = evaluate(recon_state, gt_map, all_records)
    _progress("cash", 82, "Computing cash position")
    cash = cash_position(all_records, recon_state.matched_ids(), recon_state.exception_ids, meta)

    from evaluation.agent_metrics import compute_agent_metrics
    metrics.update(compute_agent_metrics(autonomous_state, recon_state, metrics, cash, policy))

    _progress("reporting", 92, "Writing reports and finalizing")
    reporter = ReportingAgent(recon_state, metrics, cash, meta, cfg, reports_dir=reports_dir)
    reporter.write_all()

    matched_clusters = []
    for g in recon_state.final_groups():
        if len(g) >= 2:
            cluster_members = [all_records[rid].model_dump() for rid in g if rid in all_records]
            method = recon_state.group_method_of(next(iter(g)))
            matched_clusters.append({
                "group_id": f"GRP-{len(matched_clusters)+1:03d}",
                "method": method,
                "count": len(cluster_members),
                "members": cluster_members,
            })

    _progress("done", 100, "Reconciliation complete")
    return {
        "batch_id": batch_id,
        "total_records": len(all_records),
        "source_counts": source_counts,
        "metrics": metrics,
        "cash_position": cash,
        "matched_clusters": matched_clusters,
        "exceptions": [e.model_dump() for e in recon_state.exceptions],
        "audit_trail": recon_state.audit,
        "pipeline_stats": recon_state.stats,
        "reasoner_mode": recon_state.stats.get("reasoner_mode", llm_mode),
        "goal": goal,
        "policy": policy.model_dump(),
        "agent_trace": autonomous_state.to_trace(),
        "pending_approvals": [a.model_dump() for a in autonomous_state.pending_approvals],
        "agent_status": autonomous_state.status,
        "agent_steps": autonomous_state.step_count,
    }
