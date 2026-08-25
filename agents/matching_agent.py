"""Matching Agent: proposes and scores candidate matches, tier by tier.

Advanced Fintech Capabilities:
- Pass 0: Self-reversing Phantom Net-Zero UPI / Failed Payment Detection.
- Tier 1: Exact Matcher with Precision Paisa Round-off Rule & Stale/Duplicate UTR Guard.
- Tier 1.5: Credit Notes & Debit Notes (Sales Returns & Multi-Item Net Settlements).
- Tier 2: Multi-Signal Fuzzy Matcher with Adaptive 30-Day Window.
- Tier 3: Autonomous AI Reasoner with Razorpay MDR, TDS & Merchant Disambiguation.
"""
from __future__ import annotations

from agents.exception_agent import ExceptionAgent
from tools.candidate_retrieval import retrieve_candidates
from tools.exact_match import exact_match
from tools.fuzzy_match import FUZZY_ACCEPT, fuzzy_match
from tools.llm_reasoning import LLM_ACCEPT, batch_reason_over_candidates, resolve_mode
from tools.normalize import MatchDecision, Record


class MatchingAgent:
    def __init__(self, state, cfg):
        self.state = state
        self.cfg = cfg

    # ---- Pass 0: Phantom Net-Zero / Auto-Reversed UPI Detection -----------
    def run_phantom_reversal_pass(self) -> int:
        """Detects failed/reversed transactions that net to zero within the same feed."""
        merged = 0
        by_source: dict[str, list[Record]] = {}
        for rec in self.state.unresolved():
            by_source.setdefault(rec.source, []).append(rec)

        reversal_keywords = {"rev", "reversal", "failed", "fail", "refund", "phantom", "bounce", "rejected", "return"}

        for source, records in by_source.items():
            used = set()
            for i in range(len(records)):
                if records[i].record_id in used or self.state.is_grouped(records[i].record_id):
                    continue
                a = records[i]
                for j in range(i + 1, len(records)):
                    if records[j].record_id in used or self.state.is_grouped(records[j].record_id):
                        continue
                    b = records[j]

                    # Equal and opposite amount
                    if abs(a.amount + b.amount) <= 0.01 and abs(a.amount) > 0:
                        ddays = abs((a.date - b.date).days)
                        if ddays <= 3:
                            # Check shared reference or reversal narration
                            desc_comb = f"{a.description} {b.description}".lower()
                            has_rev_keyword = any(k in desc_comb for k in reversal_keywords)
                            has_ref_match = (a.ref_norm and a.ref_norm == b.ref_norm) or bool(set(a.ref_tokens) & set(b.ref_tokens))

                            if has_rev_keyword or has_ref_match or ddays == 0:
                                decision = MatchDecision(
                                    matched=True,
                                    method="exact",
                                    confidence=1.00,
                                    reason=f"Phantom net-zero reversal: auto-refunded/failed UPI transaction of ₹{abs(a.amount):.2f} (self-balancing pair)",
                                    signals={"is_phantom_reversal": True, "amount": abs(a.amount), "days_diff": ddays}
                                )
                                st = self.state.try_merge(a.record_id, b.record_id, decision, allow_multi=True)
                                if st == "merged":
                                    used.add(a.record_id)
                                    used.add(b.record_id)
                                    merged += 1
                                    break
        self.state.stats["phantom_reversals_resolved"] = merged
        return merged

    # ---- Tier 1: Exact Pass ------------------------------------------------
    def run_exact_pass(self) -> int:
        merged = self.run_phantom_reversal_pass()

        ref_groups: dict[str, list[Record]] = {}
        for rec in self.state.records.values():
            if rec.ref_norm:
                ref_groups.setdefault(rec.ref_norm, []).append(rec)
            for tok in rec.ref_tokens:
                if tok and tok != rec.ref_norm:
                    ref_groups.setdefault(tok, []).append(rec)

        for ref, members in sorted(ref_groups.items()):
            # Deduplicate members by record_id
            seen_ids = set()
            unique_members = []
            for m in members:
                if m.record_id not in seen_ids:
                    seen_ids.add(m.record_id)
                    unique_members.append(m)
            unique_members = sorted(unique_members, key=lambda r: r.record_id)

            # Stale / Duplicate UTR Collision Guard:
            # If same source has multiple records with same UTR but different amounts, mark conflict
            same_source_records: dict[str, list[Record]] = {}
            for m in unique_members:
                same_source_records.setdefault(m.source, []).append(m)

            for src, recs in same_source_records.items():
                if len(recs) > 1:
                    amounts = {abs(r.amount) for r in recs}
                    if len(amounts) > 1:
                        # Ambiguous UTR reuse across distinct amounts -> do not blind-match
                        for r in recs:
                            self.state.hints[r.record_id] = {
                                "reason": "DUPLICATE_UTR_COLLISION",
                                "explanation": f"Recycled or collided UTR reference '{ref}' used across multiple {src} records with different amounts."
                            }

            # Prioritize same-sign pairs first (to separate reversals from base settlements)
            pairs = []
            for i in range(len(unique_members)):
                for j in range(i + 1, len(unique_members)):
                    a, b = unique_members[i], unique_members[j]
                    if a.source == b.source:
                        continue
                    same_sign = (a.amount * b.amount > 0) or (a.amount == 0 and b.amount == 0)
                    pairs.append((0 if same_sign else 1, a, b))

            pairs.sort(key=lambda t: t[0])

            for _, a, b in pairs:
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

        # Run multi-part matching for credit notes, split payments, and bulk settlements
        merged += self.run_multipart_pass()
        self.state.stats["exact_pairs_merged"] = merged
        return merged

    # ---- Multi-Part Pass (Credit Notes, Split Payments & Bulk Settlements) --
    def run_multipart_pass(self) -> int:
        merged = 0

        # Group unresolved records by shared reference tokens
        token_groups: dict[str, dict[str, list[Record]]] = {}
        for rec in self.state.records.values():
            for tok in rec.ref_tokens:
                if not tok or len(tok) < 3:
                    continue
                token_groups.setdefault(tok, {}).setdefault(rec.source, []).append(rec)

        for tok, sources in token_groups.items():
            bank_recs = sources.get("bank", [])
            inv_recs = sources.get("invoice", [])
            ledger_recs = sources.get("ledger", [])

            # 1. Credit Notes / Debit Notes & Sales Return Adjustments:
            # Positive Invoice + Negative Credit Note matching net Bank settlement
            if len(inv_recs) >= 2 and len(bank_recs) == 1:
                bank_rec = bank_recs[0]
                bank_amt = abs(bank_rec.amount)
                # Compute net sum of invoices (including negative credit notes)
                net_inv_sum = sum(i.amount for i in inv_recs)
                if abs(bank_amt - abs(net_inv_sum)) <= max(0.02 * bank_amt, 50.0):
                    decision = MatchDecision(
                        matched=True,
                        method="exact",
                        confidence=0.98,
                        reason=f"Credit Note adjustment: {len(inv_recs)} invoices/credit notes (net ₹{net_inv_sum:.2f}) settled via bank payout ₹{bank_amt:.2f}",
                        signals={"is_credit_note_adj": True, "token": tok, "net_amount": net_inv_sum}
                    )
                    for inv in inv_recs:
                        st = self.state.try_merge(bank_rec.record_id, inv.record_id, decision, allow_multi=True)
                        if st == "merged":
                            merged += 1
                    for l in ledger_recs:
                        if not self.state.same_group(bank_rec.record_id, l.record_id):
                            self.state.try_merge(bank_rec.record_id, l.record_id, decision, allow_multi=True)

            # 2. Split Bank Payments (e.g. 2 Bank lines settling 1 invoice/ledger)
            target_recs = inv_recs or ledger_recs
            if len(bank_recs) >= 2 and len(target_recs) >= 1:
                for target in target_recs:
                    target_amt = abs(target.amount)
                    sum_bank = sum(abs(b.amount) for b in bank_recs)
                    # Check if bank sum matches target net of Razorpay fee (up to 3.5%)
                    if abs(sum_bank - target_amt) <= max(0.04 * target_amt + 5.0, 100.0) or (
                        sum_bank <= target_amt and abs(target_amt - sum_bank) <= max(0.04 * target_amt + 5.0, 100.0)
                    ):
                        decision = MatchDecision(
                            matched=True,
                            method="fuzzy",
                            confidence=0.92,
                            reason=f"Split payment: {len(bank_recs)} bank settlements sum to ₹{sum_bank:.2f} for {tok} (₹{target_amt:.2f})",
                            signals={"is_split": True, "is_multipart": True, "token": tok}
                        )
                        for b in bank_recs:
                            st = self.state.try_merge(target.record_id, b.record_id, decision, allow_multi=True)
                            if st == "merged":
                                merged += 1
                        for l in ledger_recs:
                            if not self.state.same_group(target.record_id, l.record_id):
                                self.state.try_merge(target.record_id, l.record_id, decision, allow_multi=True)

            # 3. Bulk Settlements (e.g. 1 Bank line settling multiple invoices/ledgers)
            if len(bank_recs) == 1 and (len(inv_recs) >= 2 or len(ledger_recs) >= 2):
                bank_rec = bank_recs[0]
                bank_amt = abs(bank_rec.amount)
                components = inv_recs or ledger_recs
                sum_components = sum(abs(c.amount) for c in components)
                if abs(bank_amt - sum_components) <= max(0.04 * sum_components + 10.0, 100.0):
                    decision = MatchDecision(
                        matched=True,
                        method="fuzzy",
                        confidence=0.92,
                        reason=f"Bulk settlement: bank payout ₹{bank_amt:.2f} covers {len(components)} items totaling ₹{sum_components:.2f}",
                        signals={"is_bulk": True, "is_multipart": True, "token": tok}
                    )
                    for c in components:
                        st = self.state.try_merge(bank_rec.record_id, c.record_id, decision, allow_multi=True)
                        if st == "merged":
                            merged += 1
                    for l in ledger_recs:
                        if not self.state.same_group(bank_rec.record_id, l.record_id):
                            self.state.try_merge(bank_rec.record_id, l.record_id, decision, allow_multi=True)

        return merged

    # ---- Tier 2: Fuzzy Pass ------------------------------------------------
    def work_queue(self):
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
            elif top_dec.confidence >= 0.50:
                stats["deferred"] += 1  # plausible but not strong enough
        self.state.stats.update({f"fuzzy_{k}": v for k, v in stats.items()})
        return stats

    # ---- Tier 3: Reasoning Pass -------------------------------------------
    def run_reasoning_pass(self) -> dict:
        stats = {"accepted": 0, "escalated": 0, "tool_errors": 0,
                 "reasoner": resolve_mode(self.cfg)}
        ex_agent = ExceptionAgent(self.state, self.cfg)

        work_items = []
        cands_map = {}
        evs_map = {}
        for rec in self.work_queue():
            if self.state.is_grouped(rec.record_id) or rec.record_id in self.state.excluded:
                continue
            cands, evs = retrieve_candidates(rec, self.state.pool(rec.record_id), self.cfg)
            if not cands:
                continue
            work_items.append((rec, cands, evs))
            cands_map[rec.record_id] = {c.record_id: c for c in cands}
            evs_map[rec.record_id] = (evs, cands)

        if not work_items:
            return stats

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
                if evs and cands:
                    best = max(zip(evs, cands),
                               key=lambda t: (t[0].amount_within_tol, -t[0].date_diff_days,
                                              t[0].desc_similarity))[1]
                    self.state.hints[rec.record_id] = {
                        "reason": code, "best": best, "confidence": res.confidence,
                        "explanation": res.reason + (f" Missing: {res.missing_evidence}"
                                                     if res.missing_evidence else "")
                    }

        self.state.stats.update({f"reasoning_{k}": v for k, v in stats.items()
                                 if k != "reasoner"})
        self.state.stats["reasoner_mode"] = stats["reasoner"]
        return stats
