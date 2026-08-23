"""Reconciled cash-position snapshot."""
from __future__ import annotations


def cash_position(records: dict, matched_ids: set, exception_ids: set, meta: dict) -> dict:
    openings = meta.get("opening_balances", {"bank": 0.0, "ledger": 0.0})
    accounts_meta = meta.get("accounts", [])

    # Calculate movements by exact source ID
    movements_by_src: dict[str, float] = {}
    for r in records.values():
        if r.record_id in matched_ids:
            movements_by_src[r.source] = movements_by_src.get(r.source, 0.0) + r.amount

    # Aggregate by broad category
    bank_mov = sum(
        amt for src, amt in movements_by_src.items()
        if src == "bank" or src.startswith("bank:") or src.startswith("gateway:") or src.startswith("card:")
    )
    ledger_mov = sum(
        amt for src, amt in movements_by_src.items()
        if src == "ledger" or src.startswith("ledger:")
    )

    exposure_by_src: dict[str, float] = {}
    for rid in exception_ids:
        r = records[rid]
        exposure_by_src[r.source] = exposure_by_src.get(r.source, 0.0) + abs(r.amount)

    bank_opening = openings.get("bank", 0.0)
    ledger_opening = openings.get("ledger", 0.0)

    confirmed_bank = bank_opening + bank_mov
    confirmed_ledger = ledger_opening + ledger_mov

    # Detailed per-account breakdown if multi-account metadata provided
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
        "note": ("Bank lines book processor fees net while the ledger books gross, "
                 "so a small non-zero difference is expected and explained."),
    }
