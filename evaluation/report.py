"""Report rendering: markdown, JSON, exception CSV, console summary."""
from __future__ import annotations

import json
from pathlib import Path
import pandas as pd


def _bar(n: int, max_n: int, width: int = 26) -> str:
    if max_n <= 0:
        return ""
    return "█" * max(1, int(width * n / max_n)) if n else ""


def render_markdown(ctx: dict) -> str:
    m, cash, state = ctx["metrics"], ctx["cash"], ctx["state"]
    mc = m["method_counts"]
    max_n = max(mc.values()) if mc else 1
    L: list[str] = []
    L.append("# AI Finance Controller — Reconciliation Report\n")
    L.append(f"**Batch / Source:** `{ctx['batch_id']}`  ")
    L.append(f"**Records Processed:** {m['total_records']} (bank / ledger / invoice)  ")
    L.append(f"**Reasoner Engine:** `{state.stats.get('reasoner_mode','n/a')}`\n")

    L.append("## Headline Summary\n")
    L.append("```text")
    if m["has_ground_truth"] and m["validated_match_rate"] is not None:
        L.append(f"Matched: {m['matched_records']}/{m['total_records']} | "
                 f"Raw match rate: {m['raw_match_rate']*100:.2f}% | "
                 f"Validated match rate: {m['validated_match_rate']*100:.2f}%")
        L.append(f"Exact: {mc['exact']} | Fuzzy: {mc['fuzzy']} | "
                 f"Agentic reasoning: {mc['llm']} | Exceptions: {m['exceptions']}")
        L.append(f"Precision: {m['precision']*100:.1f}% | Recall: {m['recall']*100:.1f}% | "
                 f"F1: {m['f1']*100:.1f}%  "
                 f"(links — TP {m['tp_links']} / FP {m['fp_links']} / FN {m['fn_links']})")
    else:
        L.append(f"Matched: {m['matched_records']}/{m['total_records']} | "
                 f"Match rate: {m['raw_match_rate']*100:.2f}%")
        L.append(f"Exact: {mc['exact']} | Fuzzy: {mc['fuzzy']} | "
                 f"Agentic reasoning: {mc['llm']} | Exceptions: {m['exceptions']}")
        L.append(f"Mode: Production / User CSVs (Ground truth not provided)")
    L.append("```\n")

    L.append("## Reconciliation Method Breakdown\n")
    L.append("| Tier | Records Resolved | Coverage Chart |")
    L.append("|---|---:|---|")
    L.append(f"| Exact Match (Tier 1) | {mc['exact']} | `{_bar(mc['exact'], max_n)}` |")
    L.append(f"| Fuzzy Match (Tier 2) | {mc['fuzzy']} | `{_bar(mc['fuzzy'], max_n)}` |")
    L.append(f"| Agentic LLM Reasoning (Tier 3) | {mc['llm']} | `{_bar(mc['llm'], max_n)}` |")
    L.append(f"| Exceptions Triaged | {m['exceptions']} | `{_bar(m['exceptions'], max_n)}` |\n")

    L.append("## Cash-Position Snapshot\n")
    L.append("```text")
    L.append(f"Confirmed bank cash:          ${cash['confirmed_bank_cash']:,.2f}")
    L.append(f"Confirmed ledger cash:        ${cash['confirmed_ledger_cash']:,.2f}")
    L.append(f"Reconciled difference:        ${cash['reconciled_difference']:,.2f}")
    L.append(f"Unresolved exception exposure: ${cash['exception_exposure_total']:,.2f}")
    L.append("```")
    L.append(f"> {cash['note']}\n")

    L.append("## Exceptions (Zero Silent Drops Guarantee)\n")
    if state.exceptions:
        L.append("| record_id | source | reason | best_candidate | confidence | action |")
        L.append("|---|---|---|---|---:|---|")
        for e in sorted(state.exceptions, key=lambda x: x.record_id):
            bc = e.best_candidate_id or "—"
            L.append(f"| {e.record_id} | {e.source} | {e.reason} | {bc} | "
                     f"{e.confidence:.2f} | {e.recommended_action} |")
        L.append("")
        for e in sorted(state.exceptions, key=lambda x: x.record_id):
            L.append(f"- **{e.record_id}** ({e.source}): {e.explanation}")
    else:
        L.append("None — every record successfully resolved.\n")

    L.append("\n## Agent Decision Policy\n")
    cfg = ctx["config"]
    L.append(f"- Acceptance Gates: exact=1.00, fuzzy≥{cfg.fuzzy_accept}, reasoning≥{cfg.llm_accept}")
    L.append(f"- Near-tie escalation guard when top candidates are within {cfg.near_tie}")
    L.append(f"- Amount tolerance ±max(2%, $1); fuzzy date window ±{cfg.fuzzy_date_window}d; retrieval window ±{cfg.retrieve_date_window}d / {cfg.retrieve_amount_pct*100:.0f}%")
    L.append(f"- Same-source collision prevention → flagged as POSSIBLE_DUPLICATE")
    L.append(f"- Tool failure fail-safe → flagged as TOOL_ERROR exception\n")

    L.append("## Execution Statistics\n")
    L.append("```json")
    L.append(json.dumps(state.stats, indent=2, default=str))
    L.append("```\n")
    L.append(f"_Audit log with {len(state.audit)} entries written to `reports/audit_log.json`_\n")
    return "\n".join(L)


def render_console_summary(ctx: dict) -> str:
    m, cash = ctx["metrics"], ctx["cash"]
    mc = m["method_counts"]
    lines = [
        "",
        "AI FINANCE CONTROLLER — RECONCILIATION SUMMARY",
        "==============================================",
        f"Batch ID: {ctx['batch_id']}",
        f"Total records: {m['total_records']}",
        "",
    ]
    if m["has_ground_truth"] and m["validated_match_rate"] is not None:
        lines.extend([
            f"Matched: {m['matched_records']}/{m['total_records']} | "
            f"Match Rate: {m['raw_match_rate']*100:.2f}% (validated {m['validated_match_rate']*100:.2f}%)",
            f"Exact: {mc['exact']} | Fuzzy: {mc['fuzzy']} | Agentic reasoning: {mc['llm']} | Exceptions: {m['exceptions']}",
            f"Precision: {m['precision']*100:.1f}% | Recall: {m['recall']*100:.1f}% | F1: {m['f1']*100:.1f}%",
        ])
    else:
        lines.extend([
            f"Matched: {m['matched_records']}/{m['total_records']} | Match Rate: {m['raw_match_rate']*100:.2f}%",
            f"Exact: {mc['exact']} | Fuzzy: {mc['fuzzy']} | Agentic reasoning: {mc['llm']} | Exceptions: {m['exceptions']}",
            "Ground Truth: None (Production Ingestion Mode)",
        ])

    lines.extend([
        "",
        "Cash Position Snapshot",
        "----------------------",
        f"Confirmed bank cash:            ${cash['confirmed_bank_cash']:,.2f}",
        f"Confirmed ledger cash:          ${cash['confirmed_ledger_cash']:,.2f}",
        f"Reconciled difference:          ${cash['reconciled_difference']:,.2f}",
        f"Unresolved exception exposure:  ${cash['exception_exposure_total']:,.2f}",
    ])
    return "\n".join(lines)


def write_outputs(ctx: dict, reports_dir) -> list[str]:
    reports_dir = Path(reports_dir)
    reports_dir.mkdir(parents=True, exist_ok=True)
    paths = []

    md = reports_dir / "recon_report.md"
    md.write_text(render_markdown(ctx), encoding="utf-8")
    paths.append(str(md))

    js = reports_dir / "recon_report.json"
    payload = {
        "batch_id": ctx["batch_id"],
        "metrics": ctx["metrics"],
        "cash_position": ctx["cash"],
        "reasoner_mode": ctx["state"].stats.get("reasoner_mode"),
        "exceptions": [e.model_dump() for e in ctx["state"].exceptions],
        "thresholds": {"fuzzy_accept": ctx["config"].fuzzy_accept,
                       "llm_accept": ctx["config"].llm_accept,
                       "near_tie": ctx["config"].near_tie},
    }
    js.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
    paths.append(str(js))

    csv_path = reports_dir / "exceptions.csv"
    rows = [e.model_dump() for e in ctx["state"].exceptions]
    pd.DataFrame(rows).to_csv(csv_path, index=False)
    paths.append(str(csv_path))

    audit = reports_dir / "audit_log.json"
    audit.write_text(json.dumps(ctx["state"].audit, indent=2, default=str), encoding="utf-8")
    paths.append(str(audit))
    return paths
