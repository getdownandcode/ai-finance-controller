"""Candidate retrieval: smart blocking before any scoring happens.

Enhancements:
- Magnitude matching (handles debit/credit sign inversions across Bank and Ledger/Invoice).
- Extended 30-day settlement window (handles standard Net-15/Net-30 B2B invoice terms).
- Flexible fee netting window (allows candidate retrieval for gross vs net amounts with processor fees).
"""
from __future__ import annotations

from pydantic import BaseModel

from tools.normalize import Record, amount_tolerance, desc_text, text_similarity


class Evidence(BaseModel):
    """Pre-computed pairwise signals between a target and one candidate."""
    candidate: Record
    amount_diff: float
    amount_within_tol: bool
    date_diff_days: int
    desc_similarity: float
    ref_equal: bool
    ref_overlap: bool
    currency_match: bool
    sign_inverted: bool = False


def retrieve_candidates(record: Record, pool: list[Record], cfg) -> tuple[list[Record], list[Evidence]]:
    """Return cross-source candidates within flexible date/amount windows.

    Windows are wide enough to capture Net-30 lags and merchant fee netting;
    the multi-tier scoring engine evaluates precision and confidence.
    """
    cands: list[Record] = []
    evs: list[Evidence] = []

    # Configurable or adaptive defaults
    date_window = getattr(cfg, "retrieve_date_window", 30) or 30
    amt_pct = getattr(cfg, "retrieve_amount_pct", 0.15) or 0.15

    rec_amt_abs = abs(record.amount)
    rec_desc = desc_text(record)

    for cand in pool:
        # Cross-source matching only
        if cand.source == record.source:
            continue

        ddays = abs((record.date - cand.date).days)
        if ddays > date_window:
            continue

        cand_amt_abs = abs(cand.amount)

        # Check direct difference vs magnitude difference (debit/credit sign inversion)
        diff_direct = abs(record.amount - cand.amount)
        diff_mag = abs(rec_amt_abs - cand_amt_abs)
        sign_inverted = (record.amount * cand.amount < 0) and (diff_mag < diff_direct)

        adiff = diff_mag if sign_inverted else min(diff_direct, diff_mag)

        # Allow within tolerance or standard payment processor fee range (up to 15% or $10)
        max_allowed_diff = max(amt_pct * rec_amt_abs, 10.0)
        if adiff > max_allowed_diff:
            continue

        desc_sim = round(text_similarity(rec_desc, desc_text(cand)), 3)

        ev = Evidence(
            candidate=cand,
            amount_diff=round(adiff, 2),
            amount_within_tol=adiff <= amount_tolerance(rec_amt_abs),
            date_diff_days=ddays,
            desc_similarity=desc_sim,
            ref_equal=bool(record.ref_norm) and record.ref_norm == cand.ref_norm,
            ref_overlap=bool(set(record.ref_tokens) & set(cand.ref_tokens)),
            currency_match=record.currency == cand.currency,
            sign_inverted=sign_inverted
        )
        cands.append(cand)
        evs.append(ev)

    # Sort candidates by combined relevance (reference overlap first, then amount diff, date proximity, text similarity)
    def rank_score(ev: Evidence) -> tuple:
        return (
            -int(ev.ref_equal),
            -int(ev.ref_overlap),
            ev.amount_diff,
            ev.date_diff_days,
            -ev.desc_similarity
        )

    order = sorted(range(len(cands)), key=lambda i: rank_score(evs[i]))
    return [cands[i] for i in order], [evs[i] for i in order]
