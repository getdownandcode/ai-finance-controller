"""Critic: checks whether the last action helped and what to do next."""
from __future__ import annotations

from typing import Any

from agents.state import CriticVerdict


class CriticAgent:
    def evaluate(self, result: dict[str, Any], state, policy) -> CriticVerdict:
        tool = result.get("_tool", "")
        success = result.get("success", True)
        before_unresolved = result.get("_before_unresolved", None)
        after_unresolved = len(state.recon.unresolved()) if state.recon else 0

        improved = False
        if before_unresolved is not None:
            improved = after_unresolved < before_unresolved

        is_stalled = False
        if before_unresolved is not None and after_unresolved >= before_unresolved and tool in ("fuzzy_match", "llm_reasoning", "retrieve_candidates"):
            # No reduction on a matching tool suggests stall; but exact_match is allowed to be 0
            if not improved:
                is_stalled = False  # let caller track stall_counter via observations

        # Confidence justification
        confidence = result.get("confidence", result.get("merged", 0))
        # Coverage invariant
        if state.recon:
            covered = state.recon.matched_ids() | state.recon.exception_ids
            missing = set(state.recon.records) - covered
            # Not yet terminal — missing is expected mid-run

        valid = success and result.get("error") is None

        # Escalation signals
        should_escalate = False
        if result.get("escalated", 0) > 0 or result.get("exceptions_raised", 0) > 0:
            should_escalate = True

        # Retry vs revise
        should_retry = False
        should_revise = False
        suggested: str | None = None
        if not valid:
            should_retry = True
            suggested = tool
        elif not improved and tool in ("exact_match", "fuzzy_match"):
            # Exact did nothing — try next tier
            should_revise = True
            suggested = "fuzzy_match" if tool == "exact_match" else "llm_reasoning"
        elif has_conflict := state.observations[-1].has_conflicting_evidence if state.observations else False:
            should_revise = True
            suggested = "llm_reasoning"

        reason_parts: list[str] = []
        if valid and improved:
            reason_parts.append(f"Improved: unresolved {before_unresolved} -> {after_unresolved}")
        elif valid and not improved:
            reason_parts.append(f"No new coverage from {tool} (unresolved {after_unresolved})")
        if not valid:
            reason_parts.append(f"Tool {tool} error: {result.get('error')}")
        if should_escalate:
            reason_parts.append("Escalations present — will triage remaining as exceptions later")

        # Also handle explicit stall signal from policy
        if state.stall_counter >= policy.execution.stall_threshold_steps - 1:
            is_stalled = True
            reason_parts.append(f"Stall counter {state.stall_counter} approaching threshold")

        verdict = CriticVerdict(
            valid=valid,
            improved=improved,
            should_retry=should_retry,
            should_escalate=should_escalate,
            should_revise_plan=should_revise,
            is_stalled=is_stalled,
            reason="; ".join(reason_parts) if reason_parts else "ok",
            suggested_next_tool=suggested,
        )
        if state.recon:
            state.recon.log("critic", "verdict", tool=tool, valid=valid, improved=improved,
                            should_retry=should_retry, should_revise=should_revise,
                            suggested=suggested, reason=verdict.reason)
        return verdict
