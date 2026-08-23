"""Tier 1 — deterministic exact matching. Confidence 1.00."""
from __future__ import annotations

from tools.normalize import MatchDecision, Record

EXACT_MAX_DATE_DIFF = 5


def exact_match(a: Record, b: Record) -> MatchDecision | None:
    if not a.ref_norm or a.ref_norm != b.ref_norm:
        return None
    if a.currency != b.currency:
        return None

    # Amount magnitude match (handles sign inversion across feeds)
    amt_diff = min(abs(a.amount - b.amount), abs(abs(a.amount) - abs(b.amount)))
    if amt_diff > 0.005:
        return None

    ddays = abs((a.date - b.date).days)
    if ddays > EXACT_MAX_DATE_DIFF:
        return None

    return MatchDecision(
        matched=True,
        method="exact",
        confidence=1.00,
        reason=f"Identical reference {a.reference!r}, amount and currency; dates within {ddays}d.",
        signals={
            "ref_equal": True,
            "amount_diff": round(amt_diff, 2),
            "date_diff_days": ddays
        },
    )
