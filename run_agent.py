#!/usr/bin/env python3
"""Entry point: Flexible production runner for the AI Finance Controller Agent.

Supports both synthetic benchmark datasets and arbitrary user-provided CSVs
(QuickBooks, Xero, Stripe, Chase, Brex, SVB, Mercury, etc.).
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

import pandas as pd

from agents.controller_agent import AgentConfig, ControllerAgent
from agents.reporting_agent import ReportingAgent
from evaluation.score import evaluate, load_ground_truth
from generate_data import generate
from tools.cash_position import cash_position
from tools.normalize import Record, parse_records_from_dataframe


def load_user_csv(file_path: Path | str | None, source_type: str) -> list[Record]:
    if not file_path:
        return []
    p = Path(file_path)
    if not p.exists():
        return []
    try:
        df = pd.read_csv(p)
        return parse_records_from_dataframe(df, source_type)
    except Exception as e:
        print(f"[warning] Error reading {p} for source '{source_type}': {e}")
        return []


def main():
    ap = argparse.ArgumentParser(
        description="AI Finance Controller — Production Agentic Reconciliation System"
    )
    ap.add_argument("--data-dir", default="data", help="Directory containing standard feeds")
    ap.add_argument("--bank-csv", default=None, help="Custom path to bank feed CSV")
    ap.add_argument("--ledger-csv", default=None, help="Custom path to ledger CSV")
    ap.add_argument("--invoices-csv", default=None, help="Custom path to invoices CSV")
    ap.add_argument("--ground-truth-csv", default=None, help="Optional ground truth CSV for benchmarking")
    ap.add_argument("--reports-dir", default="reports", help="Directory to save output reports")
    ap.add_argument("--llm", choices=["auto", "off", "gemini"], default="auto",
                    help="Tier-3 reasoner: auto = Gemini API if key present, else deterministic")
    ap.add_argument("--bank-opening", type=float, default=None, help="Bank opening balance")
    ap.add_argument("--ledger-opening", type=float, default=None, help="Ledger opening balance")
    ap.add_argument("--seed", type=int, default=42, help="Seed for synthetic generator")
    ap.add_argument("--regenerate", action="store_true", help="Force fresh synthetic benchmark batch")
    args = ap.parse_args()

    data_dir = Path(args.data_dir)
    
    # Resolve bank, ledger, invoice files
    bank_path = Path(args.bank_csv) if args.bank_csv else data_dir / "bank_feed.csv"
    ledger_path = Path(args.ledger_csv) if args.ledger_csv else data_dir / "ledger.csv"
    invoice_path = Path(args.invoices_csv) if args.invoices_csv else data_dir / "invoices.csv"

    # If default files do not exist and no custom CSVs passed, generate synthetic benchmark
    if not bank_path.exists() and not args.bank_csv:
        print(f"[setup] Generating synthetic benchmark batch (seed={args.seed})...")
        generate(seed=args.seed, data_dir=str(data_dir))
    elif args.regenerate:
        print(f"[setup] Regenerating fresh synthetic benchmark batch (seed={args.seed})...")
        generate(seed=args.seed, data_dir=str(data_dir))

    # Load metadata if exists
    meta_path = data_dir / "batch_meta.json"
    if meta_path.exists() and not args.bank_csv:
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
        except Exception:
            meta = {"batch_id": f"batch_seed_{args.seed}"}
    else:
        meta = {"batch_id": "production_run"}

    # Determine opening balances
    b_opening = args.bank_opening if args.bank_opening is not None else meta.get("opening_balances", {}).get("bank", 0.0)
    l_opening = args.ledger_opening if args.ledger_opening is not None else meta.get("opening_balances", {}).get("ledger", 0.0)
    meta["opening_balances"] = {"bank": b_opening, "ledger": l_opening}

    # Ingest records dynamically
    bank_records = load_user_csv(bank_path, "bank")
    ledger_records = load_user_csv(ledger_path, "ledger")
    invoice_records = load_user_csv(invoice_path, "invoice")

    all_records: dict[str, Record] = {}
    for r in bank_records + ledger_records + invoice_records:
        all_records[r.record_id] = r

    if not all_records:
        print("[error] No records found to reconcile. Please check input CSV files.")
        return

    cfg = AgentConfig(llm_mode=args.llm)

    print(f"\n==========================================================")
    print(f"   AI Finance Controller — Agentic Reconciliation System   ")
    print(f"==========================================================")
    print(f"Batch / Source : {meta.get('batch_id')}")
    print(f"Inputs         : Bank={len(bank_records)}, Ledger={len(ledger_records)}, Invoices={len(invoice_records)}")
    print(f"Total Records  : {len(all_records)}")
    print(f"LLM Mode       : {args.llm}")
    print(f"==========================================================\n")

    # Run Autonomous Reconciliation Loop
    controller = ControllerAgent(all_records, meta, cfg)
    state = controller.run()

    # Optional Ground Truth Evaluation
    gt_path = args.ground_truth_csv or (data_dir / "ground_truth.csv" if (data_dir / "ground_truth.csv").exists() else None)
    gt_map = load_ground_truth(gt_path)

    metrics = evaluate(state, gt_map, all_records)
    cash = cash_position(all_records, state.matched_ids(), state.exception_ids, meta)

    # Report & Audit Generation
    reporter = ReportingAgent(state, metrics, cash, meta, cfg, reports_dir=args.reports_dir)
    paths = reporter.write_all()

    print(reporter.console_summary())
    print("\nGenerated Reports:")
    for p in paths:
        print(f"  ✓ {p}")


if __name__ == "__main__":
    main()
