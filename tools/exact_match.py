"""Tier 1 — deterministic exact & paisa round-off matching. Confidence 0.99 - 1.00."""
from __future__ import annotations

from tools.normalize import MatchDecision, Record

EXACT_MAX_DATE_DIFF = 6


def exact_match(a: Record, b: Record) -> MatchDecision | None:
    if not a.ref_norm or a.ref_norm != b.ref_norm:
        return None
    if a.currency != b.currency:
        return None

    ddays = abs((a.date - b.date).days)
    if ddays > EXACT_MAX_DATE_DIFF:
        return None

    # Amount magnitude match (handles sign inversion across feeds)
    amt_diff = min(abs(a.amount - b.amount), abs(abs(a.amount) - abs(b.amount)))

    # 1. Exact mathematical match
    if amt_diff <= 0.005:
        return MatchDecision(
            matched=True,
            method="exact",
            confidence=1.00,
            reason=f"Identical reference {a.reference!r}, amount (₹{abs(a.amount):.2f}) and currency; dates within {ddays}d.",
            signals={
                "ref_equal": True,
                "amount_diff": round(amt_diff, 2),
                "date_diff_days": ddays,
                "paisa_roundoff": False
            },
        )

    # 2. Precision Paisa Round-off Rule (±₹0.01 to ₹0.99 for GST / Invoicing rounding)
    if amt_diff <= 0.99:
        return MatchDecision(
            matched=True,
            method="exact",
            confidence=0.99,
            reason=f"Paisa round-off variance: reference {a.reference!r} matched with ₹{amt_diff:.2f} round-off adjustment (< ₹1.00).",
            signals={
                "ref_equal": True,
                "amount_diff": round(amt_diff, 2),
                "date_diff_days": ddays,
                "paisa_roundoff": True
            },
        )

    return None
