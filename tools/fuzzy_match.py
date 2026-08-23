"""Tier 2 — multi-signal fuzzy matching.

Evaluates multi-signal financial evidence:
- Reference token matching
- Exact amount & tolerance scoring
- Merchant / Counterparty entity text similarity
- Settlement date proximity
"""
from __future__ import annotations

from tools.candidate_retrieval import Evidence
from tools.normalize import MatchDecision, Record, amount_tolerance

FUZZY_ACCEPT = 0.88


def fuzzy_confidence(a: Record, b: Record, ev: Evidence, cfg) -> float:
    fuzzy_window = getattr(cfg, "fuzzy_date_window", 15) or 15
    tol = amount_tolerance(abs(a.amount))

    # Signal 1: Shared exact reference or reference token overlap
    if ev.ref_equal and ev.currency_match:
        if ev.amount_within_tol and ev.date_diff_days <= fuzzy_window:
            amt_c = 1.0 - min(1.0, ev.amount_diff / max(tol, 0.01))
            date_c = 1.0 - min(1.0, ev.date_diff_days / fuzzy_window)
            return min(0.99, 0.92 + 0.05 * amt_c + 0.02 * date_c)
        return 0.75

    if ev.ref_overlap and ev.currency_match and ev.amount_within_tol:
        date_c = 1.0 - min(1.0, ev.date_diff_days / fuzzy_window)
        return min(0.95, 0.90 + 0.05 * date_c)

    # Signal 2: Amount precision
    if ev.amount_diff <= 0.01:
        amt_score = 1.00
    elif ev.amount_within_tol:
        amt_score = 0.90 - 0.30 * (ev.amount_diff / max(tol, 0.01))
    else:
        amt_score = max(0.0, 0.50 - (ev.amount_diff - tol) / max(tol * 2, 1.0))

    # Signal 3: Date proximity (decay over window)
    date_score = max(0.0, 1.0 - (ev.date_diff_days / max(fuzzy_window, 1)))

    # Signal 4: Entity / Description similarity
    desc_score = ev.desc_similarity

    # Composite multi-signal calculation
    conf = (0.45 * amt_score) + (0.35 * desc_score) + (0.20 * date_score)

    # Bonus points for high-quality combinations
    if ev.amount_diff <= 0.01 and desc_score >= 0.65 and ev.date_diff_days <= 7:
        conf = max(conf, 0.92)
    elif ev.amount_diff <= 0.01 and desc_score >= 0.80 and ev.date_diff_days <= 14:
        conf = max(conf, 0.94)
    elif ev.amount_within_tol and desc_score >= 0.85 and ev.date_diff_days <= 5:
        conf = max(conf, 0.90)

    return min(0.98, max(0.0, conf))


def fuzzy_match(a: Record, b: Record, ev: Evidence, cfg) -> MatchDecision:
    conf = round(fuzzy_confidence(a, b, ev, cfg), 3)
    is_matched = conf >= FUZZY_ACCEPT

    reasons = []
    if ev.ref_equal:
        reasons.append(f"Shared reference ({a.reference})")
    elif ev.ref_overlap:
        reasons.append("Matching reference token")
    if ev.amount_diff <= 0.01:
        reasons.append("Exact amount magnitude match")
    elif ev.amount_within_tol:
        reasons.append(f"Amount within tolerance (diff: ${ev.amount_diff:.2f})")
    if ev.desc_similarity >= 0.60:
        reasons.append(f"High entity/narrative match ({int(ev.desc_similarity * 100)}%)")
    if ev.date_diff_days <= 5:
        reasons.append(f"Settlement within {ev.date_diff_days}d")

    reason_str = "; ".join(reasons) if reasons else f"Fuzzy confidence {conf:.2f}"

    return MatchDecision(
        matched=is_matched,
        method="fuzzy",
        confidence=conf,
        reason=reason_str if is_matched else f"Below auto-match threshold ({conf:.2f} < {FUZZY_ACCEPT})",
        signals={
            "amount_diff": ev.amount_diff,
            "amount_within_tol": ev.amount_within_tol,
            "date_diff_days": ev.date_diff_days,
            "desc_similarity": ev.desc_similarity,
            "ref_equal": ev.ref_equal,
            "ref_overlap": ev.ref_overlap,
            "sign_inverted": ev.sign_inverted
        },
    )
