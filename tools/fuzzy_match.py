"""Tier 2 — fuzzy matching.

Conservative policy: auto-acceptance at this tier requires a SHARED REFERENCE
plus amount-within-tolerance and date-within-window. Without a shared
reference the composite score is capped below the accept threshold, so
reference-less ambiguity is always escalated to the reasoning tier.
"""
from __future__ import annotations

from tools.candidate_retrieval import Evidence
from tools.normalize import MatchDecision, Record, amount_tolerance

FUZZY_ACCEPT = 0.90


def fuzzy_confidence(a: Record, b: Record, ev: Evidence, cfg) -> float:
    if ev.ref_equal and ev.currency_match:
        if ev.amount_within_tol and ev.date_diff_days <= cfg.fuzzy_date_window:
            tol = amount_tolerance(a.amount)
            amt_c = 1.0 - min(1.0, ev.amount_diff / tol)
            date_c = 1.0 - ev.date_diff_days / cfg.fuzzy_date_window
            return min(0.99, 0.90 + 0.06 * amt_c + 0.03 * date_c)
        return 0.70  # shared reference but outside tolerances -> suspicious

    tol = amount_tolerance(a.amount)
    if ev.amount_diff <= tol:
        amt_s = 1.0 - 0.5 * (ev.amount_diff / tol)
    else:
        amt_s = max(0.0, 1.0 - (ev.amount_diff - tol) / tol)
    date_s = max(0.0, 1.0 - ev.date_diff_days / cfg.fuzzy_date_window)
    conf = 0.40 * amt_s + 0.25 * date_s + 0.30 * ev.desc_similarity
    if ev.ref_overlap:
        conf += 0.05
    if abs(a.amount - b.amount) < 0.005:
        conf += 0.10
    return min(0.89, conf)  # cannot auto-match without a shared reference


def fuzzy_match(a: Record, b: Record, ev: Evidence, cfg) -> MatchDecision:
    conf = round(fuzzy_confidence(a, b, ev, cfg), 3)
    return MatchDecision(
        matched=conf >= FUZZY_ACCEPT,
        method="fuzzy",
        confidence=conf,
        reason=("Shared reference with amount/date within tolerance."
                if conf >= FUZZY_ACCEPT else
                "Below fuzzy auto-accept threshold (needs shared reference + tolerances)."),
        signals={"amount_diff": ev.amount_diff, "amount_within_tol": ev.amount_within_tol,
                 "date_diff_days": ev.date_diff_days, "desc_similarity": ev.desc_similarity,
                 "ref_equal": ev.ref_equal, "ref_overlap": ev.ref_overlap},
    )
