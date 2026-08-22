"""Controller Agent: owns the reconciliation loop.

observe -> plan -> act -> reflect, with full audit logging, confidence
gating, conflict handling and a final no-silent-drops coverage check.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone

from agents.exception_agent import ExceptionAgent
from agents.matching_agent import MatchingAgent
from tools.normalize import Record

log = logging.getLogger(__name__)


@dataclass
class AgentConfig:
    fuzzy_accept: float = 0.90
    llm_accept: float = 0.80
    near_tie: float = 0.05
    fuzzy_date_window: int = 3
    retrieve_date_window: int = 6
    retrieve_amount_pct: float = 0.08
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

    def try_merge(self, a_id: str, b_id: str, decision) -> str:
        ra, rb = self.find(a_id), self.find(b_id)
        if ra == rb:
            return "already"
        merged_members = self.members[ra] | self.members[rb]
        per_source: dict[str, int] = {}
        for rid in merged_members:
            src = self.records[rid].source
            per_source[src] = per_source.get(src, 0) + 1
        if any(n > 1 for n in per_source.values()):
            self.log("state", "merge_conflict", a=a_id, b=b_id,
                     reason="would put two same-source records in one group")
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
    def __init__(self, records: dict[str, Record], meta: dict, cfg: AgentConfig | None = None):
        self.cfg = cfg or AgentConfig()
        self.state = ReconState(records, meta)
        self.matching = MatchingAgent(self.state, self.cfg)
        self.exception_agent = ExceptionAgent(self.state, self.cfg)

    # -- observe / plan / reflect ----------------------------------------------
    def observe(self):
        counts = {}
        for r in self.state.records.values():
            counts[r.source] = counts.get(r.source, 0) + 1
        self.state.log("controller", "observe", record_counts=counts,
                       unresolved=len(self.state.unresolved()))
        log.info("observe: %d records (bank=%d ledger=%d invoice=%d)",
                 sum(counts.values()), counts.get("bank", 0),
                 counts.get("ledger", 0), counts.get("invoice", 0))

    def plan(self) -> list[str]:
        plan = ["exact_match", "fuzzy_match", "llm_evidence_reasoning", "exception_triage"]
        self.state.log("controller", "plan", tool_order=plan,
                       thresholds={"exact": 1.00, "fuzzy": self.cfg.fuzzy_accept,
                                   "llm": self.cfg.llm_accept},
                       llm_mode=self.cfg.llm_mode)
        log.info("plan: %s (gates exact=1.00 fuzzy>=%.2f llm>=%.2f)",
                 " -> ".join(plan), self.cfg.fuzzy_accept, self.cfg.llm_accept)
        return plan

    def reflect(self, stage: str, **obs):
        self.state.log("controller", "reflect", pass_stage=stage, observation=obs)
        log.info("reflect %s: %s", stage, obs)

    # -- main loop ------------------------------------------------------------
    def run(self) -> ReconState:
        self.observe()
        self.plan()

        n_exact = self.matching.run_exact_pass()
        self.reflect("exact_pass", pairs_merged=n_exact,
                     remaining_unresolved=len(self.state.unresolved()))

        fz = self.matching.run_fuzzy_pass()
        self.reflect("fuzzy_pass", **fz,
                     remaining_unresolved=len(self.state.unresolved()))

        rs = self.matching.run_reasoning_pass()
        self.reflect("reasoning_pass", **rs,
                     remaining_unresolved=len(self.state.unresolved()))

        raised = self.exception_agent.triage()
        self.reflect("exception_triage", exceptions_raised=raised)

        self._verify_coverage()
        return self.state

    def _verify_coverage(self):
        """No silent drops: every record is matched or an explicit exception."""
        covered = self.state.matched_ids() | self.state.exception_ids
        missing = set(self.state.records) - covered
        assert not missing, f"Records lost without trace: {missing}"
        self.state.log("controller", "coverage_verified",
                       matched=len(self.state.matched_ids()),
                       exceptions=len(self.state.exception_ids), lost=len(missing))
        log.info("verify coverage OK — matched=%d exceptions=%d lost=0",
                 len(self.state.matched_ids()), len(self.state.exception_ids))
