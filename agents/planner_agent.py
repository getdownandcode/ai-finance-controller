"""Planner: goal -> dynamic plan -> next tool."""
from __future__ import annotations

from typing import Any

from tools.candidate_retrieval import Evidence, retrieve_candidates
from tools.normalize import Record


class PlannerAgent:
    def __init__(self, policy):
        self.policy = policy

    def create_plan(self, observation, goal: str) -> list[str]:
        # High-level plan as ordered tool intentions (revised every step)
        if goal in ("reconcile", "reconcile_all", "reconciliation"):
            base = ["inspect_sources", "exact_match"]
            if observation.unresolved_count > 0:
                base.append("fuzzy_match")
            if observation.unresolved_count > 0:
                base.append("llm_reasoning")
            base += ["create_exception", "calculate_cash_position", "validate_reconciliation", "generate_report"]
            return base
        if goal == "calculate_cash":
            return ["calculate_cash_position"]
        if goal == "triage":
            return ["create_exception", "calculate_cash_position"]
        if goal == "report":
            return ["generate_report"]
        # Fallback open-ended: cover full reconciliation
        return ["inspect_sources", "exact_match", "fuzzy_match", "llm_reasoning", "create_exception", "calculate_cash_position", "validate_reconciliation"]

    def choose_next_action(self, observation, tools: dict, policy, state, goal: str) -> dict[str, Any] | None:
        """Return structured action or None if goal complete."""
        recon = state.recon
        unresolved = recon.unresolved()
        if not unresolved:
            # Check if goal requires more (cash/report)
            if goal in ("reconcile", "reconcile_all") and "calculate_cash_position" not in state.completed_tools:
                return {
                    "action": "calculate_cash_position",
                    "arguments": {},
                    "reason": "All records resolved; computing cash snapshot for report.",
                    "expected_outcome": "Cash position",
                    "confidence": 0.99,
                }
            if goal in ("reconcile", "reconcile_all") and "validate_reconciliation" not in state.completed_tools:
                return {
                    "action": "validate_reconciliation",
                    "arguments": {},
                    "reason": "Coverage validation before completion.",
                    "expected_outcome": "No silent drops",
                    "confidence": 0.99,
                }
            return None

        # Respect retry budget
        for tool_name in ("exact_match", "fuzzy_match", "llm_reasoning"):
            if state.tool_call_counts.get(tool_name, 0) >= policy.execution.max_retries_per_tool and tool_name not in ("llm_reasoning",):
                # For matching passes, allow at most max_retries_per_tool; llm may be allowed more up to max_llm_calls
                if tool_name == "llm_reasoning" and state.tool_call_counts.get(tool_name, 0) >= policy.execution.max_llm_calls:
                    continue

        # 1) If exact tool hasn't run yet, try it first — cheap and precise
        if "exact_match" not in state.completed_tools:
            # Check if any unresolved pair shares ref_norm — if not, skip exact to save a step
            refs: dict[str, list[str]] = {}
            for r in recon.records.values():
                if r.ref_norm:
                    refs.setdefault(r.ref_norm, []).append(r.record_id)
            has_exact_candidate = any(len(ids) >= 2 and any(i in {u.record_id for u in unresolved} for i in ids) for ids in refs.values())
            if has_exact_candidate:
                return {
                    "action": "exact_match",
                    "arguments": {},
                    "reason": "Unresolved records include shared references; exact-match may close cheap wins.",
                    "expected_outcome": "Merge exact ref groups",
                    "confidence": 0.92,
                }
            else:
                # Still run once to prove no exact matches exist (audit completeness)
                return {
                    "action": "exact_match",
                    "arguments": {},
                    "reason": "Proving no exact-reference merges remain before fuzzy stage.",
                    "expected_outcome": "0 merges expected",
                    "confidence": 0.85,
                }

        # 2) Fuzzy pass — plausible only if at least one unresolved has a candidate with shared ref or tight tolerance
        if "fuzzy_match" not in state.completed_tools or (state.tool_call_counts.get("fuzzy_match", 0) < policy.execution.max_retries_per_tool and observation.unresolved_count > 2):
            # Peek at best evidence to justify fuzzy
            sample_n = min(5, len(unresolved))
            has_fuzzy_plausible = False
            for rec in unresolved[:sample_n]:
                cands, evs = retrieve_candidates(rec, recon.pool(rec.record_id), state.recon.meta.get("_cfg") or _cfg_from_policy(policy))
                # Use fuzzy gate logic: shared ref + within tolerances
                for ev in evs[:2]:
                    if ev.ref_equal or (ev.amount_within_tol and ev.desc_similarity > 0.5):
                        has_fuzzy_plausible = True
                        break
                if has_fuzzy_plausible:
                    break
            if "fuzzy_match" not in state.completed_tools:
                return {
                    "action": "fuzzy_match",
                    "arguments": {},
                    "reason": "Unresolved records have plausible fuzzy candidates; running tier-2 scoring." if has_fuzzy_plausible else "Attempting fuzzy tier to exhaust shared-reference matches.",
                    "expected_outcome": "Fuzzy merges or deferrals",
                    "confidence": 0.88 if has_fuzzy_plausible else 0.72,
                }
            # Second fuzzy pass only if fresh unresolved appeared after llm? Usually not needed

        # 3) Separate hinted/locked records — they have been escalated by LLM/fuzzy and should be exceptioned, not retried
        hinted_ids: list[str] = [r.record_id for r in unresolved if r.record_id in recon.hints]
        if hinted_ids:
            return {
                "action": "create_exception",
                "arguments": {"record_ids": hinted_ids[:10]} if len(hinted_ids) > 1 else {"record_id": hinted_ids[0]},
                "reason": f"{len(hinted_ids)} record(s) were escalated with ambiguous evidence — triaging as auditable exceptions.",
                "expected_outcome": "Exceptions raised",
                "confidence": 0.88,
            }

        # Guard: if last LLM did no work, don't retry LLM — triage instead
        if state.actions and state.actions[-1].tool == "llm_reasoning":
            last_res = state.actions[-1].result or {}
            if last_res.get("accepted", 0) == 0 and last_res.get("escalated", 0) == 0:
                return {
                    "action": "create_exception",
                    "arguments": {"record_ids": [r.record_id for r in unresolved[:10]]},
                    "reason": "Previous LLM pass made no progress; triaging remaining unresolved as exceptions.",
                    "expected_outcome": "Exceptions",
                    "confidence": 0.82,
                }

        # 3b) Check for no-candidate records that can be exceptioned immediately without LLM spend
        no_candidate_ids: list[str] = []
        has_candidate_ids: list[str] = []
        cfg_for_retrieval = state.recon.meta.get("_cfg") or _cfg_from_policy(policy)
        for rec in unresolved:
            if rec.record_id in recon.hints:
                continue
            cands, _ = retrieve_candidates(rec, recon.pool(rec.record_id), cfg_for_retrieval)
            if not cands:
                no_candidate_ids.append(rec.record_id)
            else:
                has_candidate_ids.append(rec.record_id)

        if no_candidate_ids and len(no_candidate_ids) >= 1:
            if has_candidate_ids and "llm_reasoning" not in state.completed_tools:
                pass  # fall through to LLM first
            else:
                return {
                    "action": "create_exception",
                    "arguments": {"record_ids": no_candidate_ids[:10]} if len(no_candidate_ids) > 1 else {"record_id": no_candidate_ids[0]},
                    "reason": f"{len(no_candidate_ids)} unresolved record(s) have no plausible counterparty — triage as exceptions.",
                    "expected_outcome": "Exceptions raised",
                    "confidence": 0.90,
                }

        # 4) LLM reasoning — only if there are ambiguous candidates remaining
        if has_candidate_ids:
            if state.tool_call_counts.get("llm_reasoning", 0) >= policy.execution.max_llm_calls:
                return {
                    "action": "create_exception",
                    "arguments": {"record_ids": has_candidate_ids[:10]},
                    "reason": "LLM budget exhausted; escalating remaining ambiguous records.",
                    "expected_outcome": "Exceptions",
                    "confidence": 0.78,
                }
            # Filter has_candidate to exclude those already tried in last llm call (avoid immediate repeat)
            if state.actions and state.actions[-1].tool == "llm_reasoning":
                last_args = state.actions[-1].arguments or {}
                last_ids = set(last_args.get("record_ids", []))
                # If last llm already tried these exact ids and made no progress, we already handled above; otherwise filter
                has_candidate_ids = [rid for rid in has_candidate_ids if rid not in last_ids or len(has_candidate_ids) > len(last_ids)]
                if not has_candidate_ids:
                    return {
                        "action": "create_exception",
                        "arguments": {"record_ids": [r.record_id for r in unresolved[:10]]},
                        "reason": "No fresh candidates for LLM; triaging remaining.",
                        "expected_outcome": "Exceptions",
                        "confidence": 0.80,
                    }
            return {
                "action": "llm_reasoning",
                "arguments": {"record_ids": has_candidate_ids[:12]},
                "reason": f"{len(has_candidate_ids)} records remain with ambiguous evidence; AI reasoning may disambiguate fee-netting / name variants.",
                "expected_outcome": "Accepted matches + escalations",
                "confidence": 0.84,
            }

        # 5) Fallback: triage whatever is left
        if unresolved:
            return {
                "action": "create_exception",
                "arguments": {"record_ids": [r.record_id for r in unresolved[:10]]},
                "reason": "No further matching tool can help; triaging remaining unresolved.",
                "expected_outcome": "Exceptions",
                "confidence": 0.80,
            }

        return None


def _cfg_from_policy(policy):
    # Minimal cfg shim for retrieve_candidates
    class Cfg:
        retrieve_date_window = policy.matching.retrieve_date_window_days
        retrieve_amount_pct = policy.matching.retrieve_amount_pct
        fuzzy_date_window = policy.matching.fuzzy_date_window_days
        near_tie = policy.matching.near_tie_threshold
        llm_accept = policy.matching.llm_match_confidence
        fuzzy_accept = policy.matching.fuzzy_match_confidence
        llm_mode = "auto"
    return Cfg()
