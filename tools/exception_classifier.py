"""Exception classification: why did this record fail to resolve?"""
from __future__ import annotations

from tools.candidate_retrieval import Evidence, retrieve_candidates
from tools.fuzzy_match import fuzzy_confidence
from tools.normalize import ExceptionItem, Record


def classify_exception(record: Record, evidences: list[Evidence], cfg) -> ExceptionItem:
    if not evidences:
        action = ("hold_for_settlement"
                  if record.source == "invoice" and record.status == "open"
                  else "close_as_orphan")
        return ExceptionItem(
            record_id=record.record_id, source=record.source, reason="NO_COUNTERPART",
            best_candidate_id=None, best_candidate_source=None, confidence=0.02,
            explanation="No plausible counterparty within the date/amount retrieval windows.",
            recommended_action=action)

    best = min(evidences, key=lambda e: (not e.amount_within_tol, e.date_diff_days,
                                         -e.desc_similarity))
    conf = round(fuzzy_confidence(record, best.candidate, best, cfg), 2)

    if not best.currency_match:
        reason, expl = "CURRENCY_MISMATCH", "Currency differs from the best candidate."
    elif not best.amount_within_tol:
        reason = "AMOUNT_MISMATCH"
        expl = (f"Best candidate {best.candidate.record_id} differs by "
                f"${best.amount_diff:.2f}, beyond the 2%/$1 tolerance.")
    elif best.date_diff_days > cfg.retrieve_date_window - 1:
        reason, expl = "DATE_OUT_OF_WINDOW", "Date gap exceeds the retrieval window."
    elif not record.ref_norm and record.source in ("bank", "ledger"):
        reason = "MISSING_REFERENCE"
        expl = ("No reference on the record; best candidate is plausible but "
                f"not confirmable (similarity {best.desc_similarity:.2f}).")
    else:
        reason = "LOW_CONFIDENCE"
        expl = ("Evidence for the best candidate is ambiguous; multiple signals weak. "
                f"description_similarity={best.desc_similarity:.2f}, "
                f"date_gap={best.date_diff_days}d.")

    return ExceptionItem(
        record_id=record.record_id, source=record.source, reason=reason,
        best_candidate_id=best.candidate.record_id, best_candidate_source=best.candidate.source,
        confidence=conf, explanation=expl, recommended_action="human_review")
