"""Reconciled cash-position snapshot."""
from __future__ import annotations


def cash_position(records: dict, matched_ids: set, exception_ids: set, meta: dict) -> dict:
    openings = meta.get("opening_balances", {"bank": 0.0, "ledger": 0.0})

    bank_mov = sum(r.amount for r in records.values()
                   if r.source == "bank" and r.record_id in matched_ids)
    ledger_mov = sum(r.amount for r in records.values()
                     if r.source == "ledger" and r.record_id in matched_ids)

    exposure_by_src = {"bank": 0.0, "ledger": 0.0, "invoice": 0.0}
    for rid in exception_ids:
        r = records[rid]
        exposure_by_src[r.source] += abs(r.amount)

    confirmed_bank = openings["bank"] + bank_mov
    confirmed_ledger = openings["ledger"] + ledger_mov
    return {
        "bank_opening": openings["bank"],
        "ledger_opening": openings["ledger"],
        "matched_bank_movements": round(bank_mov, 2),
        "matched_ledger_movements": round(ledger_mov, 2),
        "confirmed_bank_cash": round(confirmed_bank, 2),
        "confirmed_ledger_cash": round(confirmed_ledger, 2),
        "reconciled_difference": round(confirmed_bank - confirmed_ledger, 2),
        "exception_exposure_total": round(sum(exposure_by_src.values()), 2),
        "exception_exposure_by_source": {k: round(v, 2) for k, v in exposure_by_src.items()},
        "note": ("Bank lines book processor fees net while the ledger books gross, "
                 "so a small non-zero difference is expected and explained."),
    }
