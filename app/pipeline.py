"""Shared reconciliation pipeline — autonomous by default, fixed as benchmark."""
from __future__ import annotations

import logging
from pathlib import Path

import pandas as pd
from fastapi import HTTPException

from agents.controller_agent import AgentConfig, ControllerAgent
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
    bank_df: pd.DataFrame | None,
    ledger_df: pd.DataFrame | None,
    invoices_df: pd.DataFrame | None,
    gt_df: pd.DataFrame | None = None,
    *,
    bank_opening: float = 42500.0,
    ledger_opening: float = 42500.0,
    llm_mode: str = "auto",
    batch_id: str = "custom_run",
    reports_dir: Path = Path("reports"),
    mode: str = "autonomous",
    goal: str = "reconcile",
    policy_path: str | Path | None = None,
) -> dict:
    """Run pipeline — autonomous (default) or fixed, same output contract for backward compat."""
    bank_records = _parse_df(bank_df, "bank")
    ledger_records = _parse_df(ledger_df, "ledger")
    invoice_records = _parse_df(invoices_df, "invoice")

    all_parsed = bank_records + ledger_records + invoice_records
    all_records: dict[str, Record] = {}
    for r in all_parsed:
        if r.record_id in all_records:
            existing = all_records[r.record_id]
            if existing.source == r.source:
                raise HTTPException(
                    status_code=400,
                    detail=f"Duplicate record_id '{r.record_id}' inside {r.source} file — each row needs a unique ID. Check for repeated '{r.record_id}' in your {r.source} CSV.",
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

    meta = {"batch_id": batch_id, "opening_balances": {"bank": bank_opening, "ledger": ledger_opening}}
    cfg = AgentConfig(llm_mode=llm_mode)

    # --- execution path ---------------------------------------------------
    policy = Policy.load(policy_path)
    autonomous_state = None
    if mode == "fixed":
        controller = ControllerAgent(all_records, meta, cfg)
        state = controller.run()
        recon_state = state
    else:
        from agents.autonomous_controller import AutonomousController
        controller = AutonomousController(all_records, meta, policy=policy, goal=goal, cfg=cfg)
        autonomous_state = controller.run()
        recon_state = autonomous_state.recon  # ReconState for scoring/reporting compat

    gt_map = _build_gt_map(gt_df, all_records)
    metrics = evaluate(recon_state, gt_map, all_records)
    cash = cash_position(all_records, recon_state.matched_ids(), recon_state.exception_ids, meta)

    # Attach agent-specific evaluation
    if autonomous_state is not None:
        from evaluation.agent_metrics import compute_agent_metrics
        agent_metrics = compute_agent_metrics(autonomous_state, recon_state, metrics, cash, policy)
        metrics.update(agent_metrics)

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

    payload: dict = {
        "batch_id": batch_id,
        "total_records": len(all_records),
        "source_counts": {"bank": len(bank_records), "ledger": len(ledger_records), "invoice": len(invoice_records)},
        "metrics": metrics,
        "cash_position": cash,
        "matched_clusters": matched_clusters,
        "exceptions": [e.model_dump() for e in recon_state.exceptions],
        "audit_trail": recon_state.audit,
        "pipeline_stats": recon_state.stats,
        "reasoner_mode": recon_state.stats.get("reasoner_mode", llm_mode),
        "mode": mode,
        "goal": goal,
        "policy": policy.model_dump(),
    }
    if autonomous_state is not None:
        payload["agent_trace"] = autonomous_state.to_trace()
        payload["pending_approvals"] = [a.model_dump() for a in autonomous_state.pending_approvals]
        payload["agent_status"] = autonomous_state.status
        payload["agent_steps"] = autonomous_state.step_count
    return payload


def run_fixed_benchmark(*args, **kwargs) -> dict:
    kwargs["mode"] = "fixed"
    return run_reconciliation(*args, **kwargs)


def run_autonomous(*args, goal: str = "reconcile", **kwargs) -> dict:
    kwargs["mode"] = "autonomous"
    kwargs["goal"] = goal
    return run_reconciliation(*args, **kwargs)
