"""Reconciled cash-position snapshot and forward cash runway forecaster."""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any


def _normalize_category(src: str) -> str:
    s = src.lower().strip()
    if "bank" in s or "gateway" in s or "card" in s or "stripe" in s or "chase" in s:
        return "bank"
    if "ledger" in s or "journal" in s or "gl" in s:
        return "ledger"
    if "invoice" in s or "bill" in s or "ar" in s or "ap" in s:
        return "invoice"
    return s


def compute_forward_cash_forecast(
    confirmed_bank_cash: float,
    records: dict,
    matched_ids: set,
    exception_ids: set,
    reference_date: date | None = None,
) -> dict[str, Any]:
    """Computes a 30 / 60 / 90-day forward cash forecast and runway projection."""
    if reference_date is None:
        dates = [r.date for r in records.values() if hasattr(r, "date") and r.date]
        reference_date = max(dates) if dates else date.today()

    # Separate matched vs open/outstanding documents
    matched_inflows = sum(r.amount for r in records.values() if r.record_id in matched_ids and r.amount > 0)
    matched_outflows = sum(abs(r.amount) for r in records.values() if r.record_id in matched_ids and r.amount < 0)

    # Monthly baseline velocity
    monthly_inflow_velocity = max(matched_inflows, 5000.0)
    monthly_outflow_velocity = max(matched_outflows, 4000.0)

    # Aging buckets for outstanding invoices/bills
    receivables_aging = {"d0_30": 0.0, "d31_60": 0.0, "d61_90": 0.0, "d90_plus": 0.0}
    payables_aging = {"d0_30": 0.0, "d31_60": 0.0, "d61_90": 0.0, "d90_plus": 0.0}

    for r in records.values():
        cat = _normalize_category(r.source)
        is_open = r.record_id in exception_ids or getattr(r, "status", "").lower() in ("open", "pending", "unpaid")
        
        # Calculate days until due or age from reference date
        d_diff = (r.date - reference_date).days if hasattr(r, "date") and r.date else 15
        
        if cat == "invoice" or r.amount > 0:
            amt = abs(r.amount)
            if d_diff <= 30:
                receivables_aging["d0_30"] += amt
            elif d_diff <= 60:
                receivables_aging["d31_60"] += amt
            elif d_diff <= 90:
                receivables_aging["d61_90"] += amt
            else:
                receivables_aging["d90_plus"] += amt
        elif r.amount < 0:
            amt = abs(r.amount)
            if d_diff <= 30:
                payables_aging["d0_30"] += amt
            elif d_diff <= 60:
                payables_aging["d31_60"] += amt
            elif d_diff <= 90:
                payables_aging["d61_90"] += amt
            else:
                payables_aging["d90_plus"] += amt

    # Baseline 30 / 60 / 90 day projections
    inflow_30 = (receivables_aging["d0_30"] * 0.95) + (monthly_inflow_velocity * 0.70)
    outflow_30 = (payables_aging["d0_30"] * 1.00) + (monthly_outflow_velocity * 0.70)
    cash_30 = confirmed_bank_cash + inflow_30 - outflow_30

    inflow_60 = (receivables_aging["d31_60"] * 0.90) + (monthly_inflow_velocity * 0.75)
    outflow_60 = (payables_aging["d31_60"] * 1.00) + (monthly_outflow_velocity * 0.75)
    cash_60 = cash_30 + inflow_60 - outflow_60

    inflow_90 = (receivables_aging["d61_90"] * 0.85) + (monthly_inflow_velocity * 0.80)
    outflow_90 = (payables_aging["d61_90"] * 1.00) + (monthly_outflow_velocity * 0.80)
    cash_90 = cash_60 + inflow_90 - outflow_90

    # Net monthly burn / generation
    net_monthly_delta = (inflow_30 + inflow_60 + inflow_90 - outflow_30 - outflow_60 - outflow_90) / 3.0
    
    if net_monthly_delta >= 0:
        runway_months = 99.0  # Self-sustaining / Cash Flow Positive
        runway_status = "Cash Flow Positive"
    else:
        monthly_burn = abs(net_monthly_delta)
        runway_months = round(max(0.1, confirmed_bank_cash / max(monthly_burn, 1.0)), 1)
        runway_status = f"{runway_months} Months" if runway_months < 36 else "36+ Months"

    # Trajectory timeline points for charting
    timeline = [
        {
            "label": "Today",
            "days": 0,
            "cash": round(confirmed_bank_cash, 2),
            "inflows": 0.0,
            "outflows": 0.0,
            "net": 0.0,
        },
        {
            "label": "+30 Days",
            "days": 30,
            "cash": round(cash_30, 2),
            "inflows": round(inflow_30, 2),
            "outflows": round(outflow_30, 2),
            "net": round(inflow_30 - outflow_30, 2),
        },
        {
            "label": "+60 Days",
            "days": 60,
            "cash": round(cash_60, 2),
            "inflows": round(inflow_60, 2),
            "outflows": round(outflow_60, 2),
            "net": round(inflow_60 - outflow_60, 2),
        },
        {
            "label": "+90 Days",
            "days": 90,
            "cash": round(cash_90, 2),
            "inflows": round(inflow_90, 2),
            "outflows": round(outflow_90, 2),
            "net": round(inflow_90 - outflow_90, 2),
        },
    ]

    return {
        "as_of_date": str(reference_date),
        "runway_months": runway_months,
        "runway_status": runway_status,
        "net_monthly_delta": round(net_monthly_delta, 2),
        "total_receivables_pipeline": round(sum(receivables_aging.values()), 2),
        "total_payables_pipeline": round(sum(payables_aging.values()), 2),
        "receivables_aging": {k: round(v, 2) for k, v in receivables_aging.items()},
        "payables_aging": {k: round(v, 2) for k, v in payables_aging.items()},
        "forecast_30d": {
            "projected_cash": round(cash_30, 2),
            "inflows": round(inflow_30, 2),
            "outflows": round(outflow_30, 2),
            "net": round(inflow_30 - outflow_30, 2),
        },
        "forecast_60d": {
            "projected_cash": round(cash_60, 2),
            "inflows": round(inflow_60, 2),
            "outflows": round(outflow_60, 2),
            "net": round(inflow_60 - outflow_60, 2),
        },
        "forecast_90d": {
            "projected_cash": round(cash_90, 2),
            "inflows": round(inflow_90, 2),
            "outflows": round(outflow_90, 2),
            "net": round(inflow_90 - outflow_90, 2),
        },
        "timeline": timeline,
    }


def cash_position(records: dict, matched_ids: set, exception_ids: set, meta: dict) -> dict:
    openings = meta.get("opening_balances", {"bank": 0.0, "ledger": 0.0})
    accounts_meta = meta.get("accounts", [])

    # Calculate movements by category and by source key
    movements_by_src: dict[str, float] = {}
    movements_by_cat: dict[str, float] = {"bank": 0.0, "ledger": 0.0, "invoice": 0.0}

    for r in records.values():
        if r.record_id in matched_ids:
            movements_by_src[r.source] = movements_by_src.get(r.source, 0.0) + r.amount
            cat = _normalize_category(r.source)
            movements_by_cat[cat] = movements_by_cat.get(cat, 0.0) + r.amount

    exposure_by_src: dict[str, float] = {"bank": 0.0, "ledger": 0.0, "invoice": 0.0}
    for rid in exception_ids:
        r = records[rid]
        cat = _normalize_category(r.source)
        exposure_by_src[cat] = exposure_by_src.get(cat, 0.0) + abs(r.amount)

    bank_opening = openings.get("bank", 0.0)
    ledger_opening = openings.get("ledger", 0.0)

    bank_mov = movements_by_cat.get("bank", 0.0)
    ledger_mov = movements_by_cat.get("ledger", 0.0)

    confirmed_bank = bank_opening + bank_mov
    confirmed_ledger = ledger_opening + ledger_mov

    # Detailed per-account breakdown
    accounts_breakdown = []
    if accounts_meta:
        for acc in accounts_meta:
            src_key = acc.get("source_key") or acc.get("category")
            acc_op = float(acc.get("opening_balance", 0.0) or 0.0)
            acc_mov = movements_by_src.get(src_key, 0.0)
            accounts_breakdown.append({
                "account_name": acc.get("label", src_key),
                "category": acc.get("category", "bank"),
                "source_key": src_key,
                "opening_balance": round(acc_op, 2),
                "movements": round(acc_mov, 2),
                "confirmed_balance": round(acc_op + acc_mov, 2),
            })

    # Forward 30/60/90-Day Cash Runway Forecast
    forecast = compute_forward_cash_forecast(
        confirmed_bank_cash=confirmed_bank,
        records=records,
        matched_ids=matched_ids,
        exception_ids=exception_ids,
    )

    return {
        "bank_opening": round(bank_opening, 2),
        "ledger_opening": round(ledger_opening, 2),
        "matched_bank_movements": round(bank_mov, 2),
        "matched_ledger_movements": round(ledger_mov, 2),
        "confirmed_bank_cash": round(confirmed_bank, 2),
        "confirmed_ledger_cash": round(confirmed_ledger, 2),
        "reconciled_difference": round(confirmed_bank - confirmed_ledger, 2),
        "exception_exposure_total": round(sum(exposure_by_src.values()), 2),
        "exception_exposure_by_source": {k: round(v, 2) for k, v in exposure_by_src.items()},
        "accounts_breakdown": accounts_breakdown,
        "forward_cash_forecast": forecast,
        "note": "Reconciled multi-source cash position and 90-day forward runway forecast."
    }
