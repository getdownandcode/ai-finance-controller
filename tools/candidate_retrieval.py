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
    fx_candidate: bool = False


# Typical FX rate ranges against USD for common commercial currencies
ESTIMATED_FX_RANGES = {
    ("USD", "EUR"): (0.80, 1.10),
    ("EUR", "USD"): (0.90, 1.25),
    ("USD", "GBP"): (0.70, 0.95),
    ("GBP", "USD"): (1.05, 1.45),
    ("USD", "CAD"): (1.20, 1.45),
    ("CAD", "USD"): (0.68, 0.85),
    ("USD", "AUD"): (1.35, 1.65),
    ("AUD", "USD"): (0.60, 0.75),
}


def retrieve_candidates(record: Record, pool: list[Record], cfg) -> tuple[list[Record], list[Evidence]]:
    """Return cross-source candidates within flexible date/amount windows.

    Windows are wide enough to capture Net-30 lags, merchant fee netting, FX, and split payments;
    the multi-tier scoring engine evaluates precision and confidence.
    """
    cands: list[Record] = []
    evs: list[Evidence] = []

    # Configurable or adaptive defaults (default to 35 days and 15% window)
    date_window = max(30, getattr(cfg, "retrieve_date_window", 35) or 35)
    amt_pct = max(0.12, getattr(cfg, "retrieve_amount_pct", 0.15) or 0.15)

    rec_amt_abs = abs(record.amount)
    rec_desc = desc_text(record)
    rec_ref_tokens = set(record.ref_tokens)

    for cand in pool:
        # Cross-source matching only
        if cand.source == record.source:
            continue

        ddays = abs((record.date - cand.date).days)
        if ddays > date_window:
            continue

        cand_amt_abs = abs(cand.amount)
        cand_ref_tokens = set(cand.ref_tokens)

        # Check references
        ref_overlap = bool(rec_ref_tokens & cand_ref_tokens)
        ref_equal = (bool(record.ref_norm) and bool(cand.ref_norm) and record.ref_norm == cand.ref_norm) or (
            bool(record.ref_norm) and record.ref_norm in cand_ref_tokens
        ) or (
            bool(cand.ref_norm) and cand.ref_norm in rec_ref_tokens
        )

        currency_match = (record.currency == cand.currency)
        fx_cand = False

        # FX support: if currencies differ but reference matches or description matches
        if not currency_match:
            pair = (record.currency, cand.currency)
            if pair in ESTIMATED_FX_RANGES:
                low_r, high_r = ESTIMATED_FX_RANGES[pair]
                expected_equiv = rec_amt_abs * ((low_r + high_r) / 2.0)
                if abs(cand_amt_abs - expected_equiv) <= max(0.20 * expected_equiv, 25.0) and (ref_equal or ref_overlap or text_similarity(rec_desc, desc_text(cand)) >= 0.40):
                    fx_cand = True

        if not currency_match and not fx_cand:
            continue

        # Check direct difference vs magnitude difference (debit/credit sign inversion)
        diff_direct = abs(record.amount - cand.amount)
        diff_mag = abs(rec_amt_abs - cand_amt_abs)
        sign_inverted = (record.amount * cand.amount < 0) and (diff_mag < diff_direct)
        adiff = diff_mag if sign_inverted else min(diff_direct, diff_mag)

        # Allow within tolerance or standard payment processor fee range (up to 15% or $25 wire/fee)
        # If reference matches (e.g. split payment or partial payment), allow broader range
        max_allowed_diff = max(amt_pct * rec_amt_abs, 25.0)
        if (ref_equal or ref_overlap) and (adiff <= 0.65 * max(rec_amt_abs, cand_amt_abs)):
            pass  # Permit split / partial candidate for reasoning
        elif fx_cand:
            pass  # Permit FX candidate
        elif adiff > max_allowed_diff:
            continue

        desc_sim = round(text_similarity(rec_desc, desc_text(cand)), 3)

        ev = Evidence(
            candidate=cand,
            amount_diff=round(adiff, 2),
            amount_within_tol=adiff <= amount_tolerance(rec_amt_abs),
            date_diff_days=ddays,
            desc_similarity=desc_sim,
            ref_equal=ref_equal,
            ref_overlap=ref_overlap,
            currency_match=currency_match,
            sign_inverted=sign_inverted,
            fx_candidate=fx_cand,
        )
        cands.append(cand)
        evs.append(ev)

    # Sort candidates by combined relevance (reference overlap first, then amount diff, date proximity, text similarity)
    def rank_score(ev: Evidence) -> tuple:
        return (
            -int(ev.ref_equal),
            -int(ev.ref_overlap),
            -int(ev.amount_within_tol),
            ev.amount_diff,
            ev.date_diff_days,
            -ev.desc_similarity
        )

    order = sorted(range(len(cands)), key=lambda i: rank_score(evs[i]))
    return [cands[i] for i in order], [evs[i] for i in order]
