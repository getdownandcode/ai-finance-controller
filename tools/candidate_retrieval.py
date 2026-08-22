"""Candidate retrieval: cheap blocking before any scoring happens."""
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


def retrieve_candidates(record: Record, pool: list[Record], cfg) -> tuple[list[Record], list[Evidence]]:
    """Return cross-source candidates within loose date/amount windows.

    Windows here are deliberately loose (8% / 6 days); *scoring* is strict.
    """
    cands: list[Record] = []
    evs: list[Evidence] = []
    for cand in pool:
        if cand.source == record.source:
            continue
        ddays = abs((record.date - cand.date).days)
        if ddays > cfg.retrieve_date_window:
            continue
        adiff = abs(record.amount - cand.amount)
        if adiff > max(cfg.retrieve_amount_pct * abs(record.amount), 5.0):
            continue
        ev = Evidence(
            candidate=cand,
            amount_diff=round(adiff, 2),
            amount_within_tol=adiff <= amount_tolerance(record.amount),
            date_diff_days=ddays,
            desc_similarity=round(text_similarity(desc_text(record), desc_text(cand)), 3),
            ref_equal=bool(record.ref_norm) and record.ref_norm == cand.ref_norm,
            ref_overlap=bool(set(record.ref_tokens) & set(cand.ref_tokens)),
            currency_match=record.currency == cand.currency,
        )
        cands.append(cand)
        evs.append(ev)
    order = sorted(range(len(cands)), key=lambda i: (evs[i].amount_diff, evs[i].date_diff_days))
    return [cands[i] for i in order], [evs[i] for i in order]
