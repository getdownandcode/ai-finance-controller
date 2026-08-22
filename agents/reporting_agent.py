"""Reporting Agent: assembles metrics, cash snapshot and exceptions into outputs."""
from __future__ import annotations

from pathlib import Path
from evaluation.report import render_console_summary, write_outputs


class ReportingAgent:
    def __init__(self, state, metrics, cash, meta, cfg, reports_dir="reports"):
        self.ctx = {
            "batch_id": meta.get("batch_id", "unknown"),
            "state": state, "metrics": metrics, "cash": cash, "config": cfg,
        }
        self.reports_dir = Path(reports_dir)

    def write_all(self) -> list[Path]:
        return write_outputs(self.ctx, self.reports_dir)

    def console_summary(self) -> str:
        return render_console_summary(self.ctx)
