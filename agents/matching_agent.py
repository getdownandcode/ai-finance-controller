"""Matching Agent: proposes and scores candidate matches, tier by tier.

It chooses the cheapest sufficient tool first: exact -> fuzzy -> reasoning.
"""
from __future__ import annotations

from agents.exception_agent import ExceptionAgent
from tools.candidate_retrieval import retrieve_candidates
from tools.exact_match import exact_match
from tools.fuzzy_match import FUZZY_ACCEPT, fuzzy_match
from tools.llm_reasoning import LLM_ACCEPT, batch_reason_over_candidates, resolve_mode
from tools.normalize import MatchDecision


class MatchingAgent:
    def __init__(self, state, cfg):
        self.state = state
        self.cfg = cfg

    # ---- Tier 1 -----------------------------------------------------------
    def run_exact_pass(self) -> int:
        merged = 0
        ref_groups: dict[str, list] = {}
        for rec in self.state.records.values():
            if rec.ref_norm:
                ref_groups.setdefault(rec.ref_norm, []).append(rec)
        for ref, members in sorted(ref_groups.items()):
            members = sorted(members, key=lambda r: r.record_id)
            for i in range(len(members)):
                for j in range(i + 1, len(members)):
                    a, b = members[i], members[j]
                    if self.state.is_grouped(a.record_id) and self.state.same_group(a.record_id, b.record_id):
                        continue
                    decision = exact_match(a, b)
                    if decision is None:
                        continue
                    status = self.state.try_merge(a.record_id, b.record_id, decision)
                    if status == "merged":
                        merged += 1
                    elif status == "conflict":
                        ExceptionAgent(self.state, self.cfg).raise_duplicate(b, a)
        self.state.stats["exact_pairs_merged"] = merged
        return merged

    # ---- Tier 2 -----------------------------------------------------------
    def work_queue(self):
        """Prioritize records with the most options, then largest exposure."""
        def priority(rec):
            cands, _ = retrieve_candidates(rec, self.state.pool(rec.record_id), self.cfg)
            return (-len(cands), -abs(rec.amount), rec.record_id)
        return sorted(self.state.unresolved(), key=priority)

    def run_fuzzy_pass(self) -> dict:
        stats = {"matched": 0, "deferred": 0}
        for rec in self.work_queue():
            if self.state.is_grouped(rec.record_id) or rec.record_id in self.state.excluded:
                continue
            cands, evs = retrieve_candidates(rec, self.state.pool(rec.record_id), self.cfg)
            if not cands:
                continue
            scored = sorted(
                ((fuzzy_match(rec, c, ev, self.cfg), c) for c, ev in zip(cands, evs)),
                key=lambda t: -t[0].confidence)
            top_dec, top_cand = scored[0]
            if top_dec.confidence >= FUZZY_ACCEPT:
                clear = len(scored) == 1 or (top_dec.confidence - scored[1][0].confidence > self.cfg.near_tie)
                if clear:
                    status = self.state.try_merge(rec.record_id, top_cand.record_id, top_dec)
                    if status == "merged":
                        stats["matched"] += 1
                    elif status == "conflict":
                        ExceptionAgent(self.state, self.cfg).raise_duplicate(rec, top_cand)
                    continue
                stats["deferred"] += 1  # near-tie at fuzzy tier -> let reasoning decide
            elif top_dec.confidence >= 0.55:
                stats["deferred"] += 1  # plausible but not strong enough
        self.state.stats.update({f"fuzzy_{k}": v for k, v in stats.items()})
        return stats

    # ---- Tier 3 -----------------------------------------------------------
    def run_reasoning_pass(self) -> dict:
        stats = {"accepted": 0, "escalated": 0, "tool_errors": 0,
                 "reasoner": resolve_mode(self.cfg)}
        ex_agent = ExceptionAgent(self.state, self.cfg)

        # Collect all unresolved work items that have candidate pools
        work_items = []
        cands_map = {}
        evs_map = {}
        for rec in self.work_queue():
            if self.state.is_grouped(rec.record_id) or rec.record_id in self.state.excluded:
                continue
            cands, evs = retrieve_candidates(rec, self.state.pool(rec.record_id), self.cfg)
            if not cands:
                continue  # exception triage will classify it
            work_items.append((rec, cands, evs))
            cands_map[rec.record_id] = {c.record_id: c for c in cands}
            evs_map[rec.record_id] = (evs, cands)

        if not work_items:
            return stats

        # Execute single batch reasoning call
        batch_results = batch_reason_over_candidates(work_items, self.cfg)

        for rec, _, _ in work_items:
            if self.state.is_grouped(rec.record_id) or rec.record_id in self.state.excluded:
                continue

            res = batch_results.get(rec.record_id)
            if not res:
                continue

            self.state.log("reasoning", "reasoning_result", record=rec.record_id,
                           decision=res.decision, confidence=res.confidence,
                           reasoner=res.reasoner, reason=res.reason)

            cand_by_id = cands_map.get(rec.record_id, {})
            if (res.decision == "match" and res.confidence >= LLM_ACCEPT
                    and res.selected_candidate_id in cand_by_id):
                sel = cand_by_id[res.selected_candidate_id]
                decision = MatchDecision(
                    matched=True, method="llm", confidence=res.confidence,
                    reason=res.reason,
                    signals={"missing_evidence": res.missing_evidence, "reasoner": res.reasoner}
                )
                status = self.state.try_merge(rec.record_id, sel.record_id, decision)
                if status == "merged":
                    stats["accepted"] += 1
                elif status == "conflict":
                    ex_agent.raise_duplicate(rec, sel)
            else:
                if res.decision == "error":
                    stats["tool_errors"] += 1
                    code = "TOOL_ERROR"
                elif res.decision == "escalate":
                    code = "DUPLICATE_CANDIDATE"
                else:
                    code = "LOW_CONFIDENCE"
                stats["escalated"] += 1

                evs, cands = evs_map[rec.record_id]
                best = max(zip(evs, cands),
                           key=lambda t: (t[0].amount_within_tol, -t[0].date_diff_days,
                                          t[0].desc_similarity))[1]
                self.state.hints[rec.record_id] = {
                    "reason": code, "best": best, "confidence": res.confidence,
                    "explanation": res.reason + (f" Missing: {res.missing_evidence}"
                                                 if res.missing_evidence else "")
                }
                self.state.lock(rec.record_id)  # remove from candidate pool; exception pending

        self.state.stats.update({f"reasoning_{k}": v for k, v in stats.items()
                                 if k != "reasoner"})
        self.state.stats["reasoner_mode"] = stats["reasoner"]
        return stats
