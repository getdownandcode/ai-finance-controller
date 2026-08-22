"""Tier 1 — deterministic exact matching. Confidence 1.00 or nothing."""
from __future__ import annotations

from tools.normalize import MatchDecision, Record

EXACT_MAX_DATE_DIFF = 2


def exact_match(a: Record, b: Record) -> MatchDecision | None:
    if not a.ref_norm or a.ref_norm != b.ref_norm:
        return None
    if a.currency != b.currency:
        return None
    if abs(a.amount - b.amount) > 0.005:
        return None
    if abs((a.date - b.date).days) > EXACT_MAX_DATE_DIFF:
        return None
    return MatchDecision(
        matched=True,
        method="exact",
        confidence=1.00,
        reason=f"Identical reference {a.reference!r}, amount and currency; dates within {EXACT_MAX_DATE_DIFF}d.",
        signals={"ref_equal": True, "amount_diff": round(abs(a.amount - b.amount), 2),
                 "date_diff_days": abs((a.date - b.date).days)},
    )
