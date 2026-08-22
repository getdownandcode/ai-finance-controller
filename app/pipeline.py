"""Shared reconciliation pipeline — single source of truth for CLI and API.

Extracted from the duplicated logic in server.py and run_agent.py so that
fixing a bug in one place fixes it everywhere.
"""
from __future__ import annotations

import logging
from pathlib import Path

import pandas as pd
from fastapi import HTTPException

from agents.controller_agent import AgentConfig, ControllerAgent
from agents.reporting_agent import ReportingAgent
from evaluation.score import evaluate
from tools.cash_position import cash_position
from tools.normalize import Record, parse_records_from_dataframe

log = logging.getLogger(__name__)


def _parse_df(df: pd.DataFrame | None, source: str) -> list[Record]:
    if df is None or df.empty:
        return []
    return parse_records_from_dataframe(df, source)


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
) -> dict:
    """Run the full controller pipeline and return the API/CLI payload."""
    bank_records = _parse_df(bank_df, "bank")
    ledger_records = _parse_df(ledger_df, "ledger")
    invoice_records = _parse_df(invoices_df, "invoice")

    all_parsed = bank_records + ledger_records + invoice_records
    all_records: dict[str, Record] = {}
    for r in all_parsed:
        if r.record_id in all_records:
            existing = all_records[r.record_id]
            # Same source -> true duplicate inside one file, keep strict error
            if existing.source == r.source:
                raise HTTPException(
                    status_code=400,
                    detail=f"Duplicate record_id '{r.record_id}' inside {r.source} file — each row needs a unique ID. Check for repeated '{r.record_id}' in your {r.source} CSV.",
                )
            # Cross-source collision (e.g. user uploaded same file twice or
            # generic numeric IDs like '001' in both files). Auto-namespace
            # so the batch can still reconcile, but warn clearly.
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

    controller = ControllerAgent(all_records, meta, cfg)
    state = controller.run()

    # ground-truth mapping (optional, for scoring)
    gt_map = None
    if gt_df is not None and not gt_df.empty:
        try:
            cols = {str(c).lower().strip(): c for c in gt_df.columns}
            rec_col = cols.get("record_id", cols.get("id"))
            grp_col = cols.get("group_id", cols.get("group"))
            if rec_col and grp_col:
                gt_map = {str(r[rec_col]).strip(): str(r[grp_col]).strip() for _, r in gt_df.iterrows()}
                # Handle auto-namespaced IDs (e.g. "ledger:B-001") so GT still scores correctly
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
        except Exception:
            log.exception("Failed to parse ground truth mapping")
            gt_map = None

    metrics = evaluate(state, gt_map, all_records)
    cash = cash_position(all_records, state.matched_ids(), state.exception_ids, meta)

    reporter = ReportingAgent(state, metrics, cash, meta, cfg, reports_dir=reports_dir)
    reporter.write_all()

    matched_clusters = []
    for g in state.final_groups():
        if len(g) >= 2:
            cluster_members = [all_records[rid].model_dump() for rid in g if rid in all_records]
            method = state.group_method_of(next(iter(g)))
            matched_clusters.append({
                "group_id": f"GRP-{len(matched_clusters)+1:03d}",
                "method": method,
                "count": len(cluster_members),
                "members": cluster_members,
            })

    return {
        "batch_id": batch_id,
        "total_records": len(all_records),
        "source_counts": {"bank": len(bank_records), "ledger": len(ledger_records), "invoice": len(invoice_records)},
        "metrics": metrics,
        "cash_position": cash,
        "matched_clusters": matched_clusters,
        "exceptions": [e.model_dump() for e in state.exceptions],
        "audit_trail": state.audit,
        "pipeline_stats": state.stats,
        "reasoner_mode": state.stats.get("reasoner_mode", llm_mode),
    }
