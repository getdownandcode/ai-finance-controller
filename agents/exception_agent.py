"""Exception Agent: every unresolved record gets an honest, classified exception.
No silent drops."""
from __future__ import annotations

from tools.candidate_retrieval import retrieve_candidates
from tools.exception_classifier import classify_exception
from tools.normalize import ExceptionItem


class ExceptionAgent:
    def __init__(self, state, cfg):
        self.state = state
        self.cfg = cfg

    def raise_duplicate(self, rec, other) -> None:
        if rec.record_id in self.state.exception_ids:
            return
        item = ExceptionItem(
            record_id=rec.record_id, source=rec.source, reason="POSSIBLE_DUPLICATE",
            best_candidate_id=other.record_id, best_candidate_source=other.source,
            confidence=0.97,
            explanation=(f"Merging {rec.record_id} would place two {rec.source} records in "
                         f"one matched group (conflicts via {other.record_id}). Likely a "
                         "double-posting."),
            recommended_action="human_review")
        self.state.add_exception(item)

    def _raise_from_hint(self, rec) -> None:
        h = self.state.hints[rec.record_id]
        best = h.get("best")
        item = ExceptionItem(
            record_id=rec.record_id, source=rec.source, reason=h["reason"],
            best_candidate_id=best.record_id if best else None,
            best_candidate_source=best.source if best else None,
            confidence=round(float(h["confidence"]), 2),
            explanation=h["explanation"], recommended_action="human_review")
        self.state.add_exception(item)

    def triage(self) -> int:
        """Final sweep: every record still unresolved becomes an exception."""
        raised = 0
        for rec in list(self.state.unresolved()):
            if rec.record_id in self.state.exception_ids:
                continue
            if rec.record_id in self.state.hints:
                self._raise_from_hint(rec)
            else:
                _, evs = retrieve_candidates(rec, self.state.pool(rec.record_id), self.cfg)
                self.state.add_exception(classify_exception(rec, evs, self.cfg))
            raised += 1
        self.state.stats["exceptions_raised"] = len(self.state.exceptions)
        return raised
