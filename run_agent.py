#!/usr/bin/env python3
"""CLI entry point — thin wrapper over app/pipeline.py."""
from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path

import pandas as pd

from app.pipeline import run_reconciliation
from config import settings
from generate_data import generate

log = logging.getLogger(__name__)


def _load_df(path: Path | None) -> pd.DataFrame | None:
    if path is None or not Path(path).exists():
        return None
    try:
        return pd.read_csv(path)
    except Exception as exc:
        log.warning("Failed to read %s: %s", path, exc)
        return None


def main() -> None:
    ap = argparse.ArgumentParser(description="AI Finance Controller — Reconciliation Runner")
    ap.add_argument("--data-dir", default=str(settings.data_dir))
    ap.add_argument("--bank-csv", default=None)
    ap.add_argument("--ledger-csv", default=None)
    ap.add_argument("--invoices-csv", default=None)
    ap.add_argument("--ground-truth-csv", default=None)
    ap.add_argument("--reports-dir", default=str(settings.reports_dir))
    ap.add_argument("--llm", choices=["auto", "off", "gemini"], default="auto")
    ap.add_argument("--goal", choices=["reconcile", "reconcile_all", "calculate_cash", "triage", "report"], default="reconcile")
    ap.add_argument("--mode", choices=["autonomous", "fixed"], default="autonomous")
    ap.add_argument("--policy", default=None, help="Path to policy.yaml")
    ap.add_argument("--bank-opening", type=float, default=None)
    ap.add_argument("--ledger-opening", type=float, default=None)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--regenerate", action="store_true")
    ap.add_argument("--benchmark", action="store_true", help="Compare fixed vs autonomous")
    args = ap.parse_args()

    logging.basicConfig(level=getattr(logging, settings.log_level, logging.INFO),
                        format="%(levelname)s %(message)s")

    data_dir = Path(args.data_dir)
    bank_path = Path(args.bank_csv) if args.bank_csv else data_dir / "bank_feed.csv"
    ledger_path = Path(args.ledger_csv) if args.ledger_csv else data_dir / "ledger.csv"
    invoice_path = Path(args.invoices_csv) if args.invoices_csv else data_dir / "invoices.csv"

    if not bank_path.exists() and not args.bank_csv:
        log.info("Generating synthetic batch (seed=%d)", args.seed)
        generate(seed=args.seed, data_dir=str(data_dir))
    elif args.regenerate:
        log.info("Regenerating batch (seed=%d)", args.seed)
        generate(seed=args.seed, data_dir=str(data_dir))

    meta_path = data_dir / "batch_meta.json"
    if meta_path.exists() and not args.bank_csv:
        try:
            meta = json.loads(meta_path.read_text())
        except Exception:
            meta = {"batch_id": f"batch_seed_{args.seed}"}
    else:
        meta = {"batch_id": "production_run"}

    b_open = args.bank_opening if args.bank_opening is not None else meta.get("opening_balances", {}).get("bank", 0.0)
    l_open = args.ledger_opening if args.ledger_opening is not None else meta.get("opening_balances", {}).get("ledger", 0.0)

    bank_df = _load_df(bank_path)
    ledger_df = _load_df(ledger_path)
    invoices_df = _load_df(invoice_path)
    gt_df = _load_df(Path(args.ground_truth_csv) if args.ground_truth_csv else data_dir / "ground_truth.csv")

    if all(df is None or df.empty for df in (bank_df, ledger_df, invoices_df)):
        log.error("No records found. Check input CSVs.")
        return

    log.info("Batch %s | bank=%d ledger=%d invoices=%d | llm=%s goal=%s mode=%s",
             meta.get("batch_id"), len(bank_df) if bank_df is not None else 0,
             len(ledger_df) if ledger_df is not None else 0,
             len(invoices_df) if invoices_df is not None else 0, args.llm, args.goal, args.mode)

    if args.benchmark:
        from app.pipeline import run_fixed_benchmark, run_autonomous
        bank_opening = b_open; ledger_opening = l_open
        fixed = run_fixed_benchmark(bank_df=bank_df, ledger_df=ledger_df, invoices_df=invoices_df, gt_df=gt_df, bank_opening=bank_opening, ledger_opening=ledger_opening, llm_mode=args.llm, batch_id=meta.get("batch_id", "production_run"), reports_dir=Path(args.reports_dir))
        autonomous = run_autonomous(bank_df=bank_df, ledger_df=ledger_df, invoices_df=invoices_df, gt_df=gt_df, bank_opening=bank_opening, ledger_opening=ledger_opening, llm_mode=args.llm, batch_id=meta.get("batch_id", "production_run"), reports_dir=Path(args.reports_dir), goal=args.goal, policy_path=args.policy)
        print("\n=== BENCHMARK: fixed vs autonomous ===")
        for label, res in [("fixed", fixed), ("autonomous", autonomous)]:
            m = res["metrics"]
            print(f"{label}: matched {m['matched_records']}/{m['total_records']} ({m['raw_match_rate']*100:.1f}%) | F1 {m.get('f1') if m.get('f1') is not None else 'N/A'} | steps {res.get('agent_steps', 4)} | status {res.get('agent_status', 'complete')}")
        return

    result = run_reconciliation(
        bank_df=bank_df, ledger_df=ledger_df, invoices_df=invoices_df, gt_df=gt_df,
        bank_opening=b_open, ledger_opening=l_open,
        llm_mode=args.llm, batch_id=meta.get("batch_id", "production_run"),
        reports_dir=Path(args.reports_dir),
        mode=args.mode, goal=args.goal, policy_path=args.policy,
    )

    # Human-readable summary mirrors server response
    m = result["metrics"]
    print(f"\nMatched {m['matched_records']}/{m['total_records']} "
          f"({m['raw_match_rate']*100:.1f}%) | "
          f"Exact {m['method_counts']['exact']} "
          f"Fuzzy {m['method_counts']['fuzzy']} "
          f"LLM {m['method_counts']['llm']} "
          f"Exceptions {m['exceptions']}")
    if "agent_steps" in result:
        print(f"Agent: goal={result.get('goal')} status={result.get('agent_status')} steps={result.get('agent_steps')} pending_approvals={len(result.get('pending_approvals', []))}")
        if result.get("agent_trace"):
            print(f"Actions: {' -> '.join(a['tool'] for a in result['agent_trace']['actions'])}")
    print(f"Reports written to {args.reports_dir}/")


if __name__ == "__main__":
    main()
