"""Observer: answers what is true right now without touching state."""
from __future__ import annotations

import time
from typing import Any

from agents.state import Observation
from tools.candidate_retrieval import retrieve_candidates
from tools.cash_position import cash_position


class ObserverAgent:
    def inspect(self, state, policy, cfg) -> Observation:
        recon = state.recon
        total = len(recon.records)
        source_counts: dict[str, int] = {}
        for r in recon.records.values():
            source_counts[r.source] = source_counts.get(r.source, 0) + 1

        matched = len(recon.matched_ids())
        exc = len(recon.exception_ids)
        unresolved_recs = recon.unresolved()
        unresolved_count = len(unresolved_recs)
        unresolved_ids = [r.record_id for r in unresolved_recs[:20]]

        coverage = (matched + exc) / total if total else 1.0

        try:
            cash = cash_position(recon.records, recon.matched_ids(), recon.exception_ids, recon.meta)
            remaining_exposure = cash.get("exception_exposure_total", 0.0)
        except Exception:
            remaining_exposure = 0.0
            cash = {}

        # Conflicting evidence: unresolved records with multiple near-tie candidates
        has_conflict = False
        conflict_detail: dict[str, Any] = {}
        check_n = min(8, len(unresolved_recs))
        for rec in unresolved_recs[:check_n]:
            cands, evs = retrieve_candidates(rec, recon.pool(rec.record_id), cfg)
            if len(cands) >= 2:
                # two candidates with very close similarity / amount diff
                top = sorted(evs, key=lambda e: (e.amount_diff, e.date_diff_days))
                if top[0].amount_diff <= 1.0 and top[1].amount_diff <= 1.0 and abs(top[0].desc_similarity - top[1].desc_similarity) < 0.08:
                    has_conflict = True
                    conflict_detail[rec.record_id] = [c.record_id for c in cands[:2]]
                    break

        tools_used = sorted(state.completed_tools)
        llm_calls_used = state.tool_call_counts.get("llm_reasoning", 0)

        obs = Observation(
            total_records=total,
            source_counts=source_counts,
            matched_count=matched,
            exception_count=exc,
            unresolved_count=unresolved_count,
            unresolved_ids=unresolved_ids,
            coverage=round(coverage, 4),
            remaining_exposure=round(remaining_exposure, 2),
            tools_used=tools_used,
            has_conflicting_evidence=has_conflict,
            llm_calls_used=llm_calls_used,
            step_count=state.step_count,
            detail={
                "cash": cash,
                "conflict_detail": conflict_detail,
                "stall_counter": state.stall_counter,
            },
        )
        recon.log("observer", "observed", total=total, source_counts=source_counts,
                  matched=matched, exceptions=exc, unresolved=unresolved_count,
                  coverage=coverage, has_conflict=has_conflict)
        return obs
