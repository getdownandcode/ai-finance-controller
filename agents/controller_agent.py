"""Recon state — single source of truth for grouping.

The fixed controller loop has been removed. Reconciliation is now
driven exclusively by the autonomous controller (observe → plan → act
→ reflect). This module retains only the inspectable union-find state
and the lightweight AgentConfig shim for policy overrides.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from tools.normalize import Record


@dataclass
class AgentConfig:
    fuzzy_accept: float = 0.88
    llm_accept: float = 0.75
    near_tie: float = 0.05
    fuzzy_date_window: int = 15
    retrieve_date_window: int = 35
    retrieve_amount_pct: float = 0.15
    llm_mode: str = "auto"   # auto | off | gemini


class ReconState:
    """Shared, inspectable state: records, groups, exceptions, audit trail."""

    def __init__(self, records: dict[str, Record], meta: dict):
        self.records = records
        self.meta = meta
        self.parent = {rid: rid for rid in records}
        self.members = {rid: {rid} for rid in records}
        self.group_methods: dict[str, set] = {rid: set() for rid in records}
        self.exceptions: list = []
        self.exception_ids: set = set()
        self.excluded: set = set()          # locked/exceptioned records, out of candidate pool
        self.hints: dict = {}
        self.audit: list = []
        self.stats: dict = {}

    # -- audit -------------------------------------------------------------
    def log(self, stage: str, event: str, **detail):
        self.audit.append({"ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                           "stage": stage, "event": event, "detail": detail})

    # -- union-find ----------------------------------------------------------
    def find(self, rid: str) -> str:
        root = rid
        while self.parent[root] != root:
            root = self.parent[root]
        while self.parent[rid] != root:
            self.parent[rid], rid = root, self.parent[rid]
        return root

    def same_group(self, a: str, b: str) -> bool:
        return self.find(a) == self.find(b)

    def is_grouped(self, rid: str) -> bool:
        return len(self.members[self.find(rid)]) >= 2

    def try_merge(self, a_id: str, b_id: str, decision, allow_multi: bool = False) -> str:
        ra, rb = self.find(a_id), self.find(b_id)
        if ra == rb:
            return "already"
        merged_members = self.members[ra] | self.members[rb]

        per_source: dict[str, list[str]] = {}
        for rid in merged_members:
            src = self.records[rid].source
            per_source.setdefault(src, []).append(rid)

        # Multi-source conflict validation
        if not allow_multi and any(len(lst) > 1 for lst in per_source.values()):
            is_valid_multipart = False
            sig = getattr(decision, "signals", {}) or {}
            if sig.get("is_split") or sig.get("is_bulk") or sig.get("is_multipart"):
                is_valid_multipart = True
            else:
                all_tokens = [set(self.records[rid].ref_tokens) for rid in merged_members if self.records[rid].ref_tokens]
                has_shared_token = bool(set.intersection(*all_tokens)) if len(all_tokens) >= 2 else False

                for src, rids in per_source.items():
                    if len(rids) > 1:
                        amts = [abs(self.records[rid].amount) for rid in rids]
                        other_src_amts = [abs(self.records[rid].amount) for s, lst in per_source.items() if s != src for rid in lst]

                        # True duplicate post conflict (exact duplicate amounts from same source competing for single counterpart)
                        if len(amts) == 2 and abs(amts[0] - amts[1]) <= 0.01 and other_src_amts and any(abs(o - amts[0]) <= 0.01 for o in other_src_amts):
                            is_valid_multipart = False
                            break

                        # Aggregate amount matches the counterpart (split payment or bulk batch)
                        if other_src_amts and any(abs(sum(amts) - o) <= max(0.04 * o + 0.50, 5.0) for o in other_src_amts):
                            is_valid_multipart = True
                        elif other_src_amts and any(abs(o - sum(amts)) <= max(0.04 * sum(amts) + 0.50, 5.0) for o in other_src_amts):
                            is_valid_multipart = True
                        elif has_shared_token:
                            is_valid_multipart = True

            if not is_valid_multipart:
                self.log("state", "merge_conflict", a=a_id, b=b_id,
                         reason="would put two same-source records in one group without split/bulk validation")
                return "conflict"

        if len(self.members[ra]) < len(self.members[rb]):
            ra, rb = rb, ra
        self.parent[rb] = ra
        self.members[ra] = merged_members
        self.group_methods[ra] = self.group_methods[ra] | self.group_methods[rb] | {decision.method}
        del self.members[rb]
        del self.group_methods[rb]
        self.log("state", "merge", a=a_id, b=b_id, method=decision.method,
                 confidence=decision.confidence, reason=decision.reason)
        return "merged"

    # -- pool / queue ---------------------------------------------------------
    def pool(self, exclude_id: str) -> list[Record]:
        return [r for rid, r in self.records.items()
                if rid != exclude_id and rid not in self.excluded]

    def unresolved(self) -> list[Record]:
        return [r for rid, r in self.records.items()
                if not self.is_grouped(rid) and rid not in self.exception_ids]

    def lock(self, rid: str):
        self.excluded.add(rid)

    def add_exception(self, item):
        if item.record_id in self.exception_ids:
            return
        self.exceptions.append(item)
        self.exception_ids.add(item.record_id)
        self.excluded.add(item.record_id)
        self.log("exceptions", "exception_raised", record=item.record_id,
                 reason=item.reason, confidence=item.confidence, action=item.recommended_action)

    # -- final views ------------------------------------------------------------
    def final_groups(self) -> list[set]:
        return [set(m) for m in self.members.values()]

    def matched_ids(self) -> set:
        return {rid for g in self.final_groups() if len(g) >= 2 for rid in g}

    def group_method_of(self, rid: str) -> str:
        methods = self.group_methods[self.find(rid)]
        if "llm" in methods:
            return "llm"
        if "fuzzy" in methods:
            return "fuzzy"
        return "exact"


class ControllerAgent:
    """Removed — autonomous controller is now the sole execution path.

    Kept as a thin alias so any stray import does not break; it forwards
    to AutonomousController with policy bounds.
    """

    def __init__(self, *args, **kwargs):
        raise RuntimeError(
            "ControllerAgent (fixed pipeline) has been removed. "
            "Use agents.autonomous_controller.AutonomousController instead."
        )
