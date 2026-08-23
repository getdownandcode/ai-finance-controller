"""Explicit agent state — every decision inspectable and replayable."""
from __future__ import annotations

import time
import uuid
from typing import Any, Literal

from pydantic import BaseModel, Field

from agents.controller_agent import ReconState


class Observation(BaseModel):
    ts: str = Field(default_factory=lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
    total_records: int = 0
    source_counts: dict[str, int] = Field(default_factory=dict)
    matched_count: int = 0
    exception_count: int = 0
    unresolved_count: int = 0
    unresolved_ids: list[str] = Field(default_factory=list)
    coverage: float = 0.0
    remaining_exposure: float = 0.0
    tools_used: list[str] = Field(default_factory=list)
    has_conflicting_evidence: bool = False
    llm_calls_used: int = 0
    step_count: int = 0
    detail: dict[str, Any] = Field(default_factory=dict)


class AgentAction(BaseModel):
    id: str = Field(default_factory=lambda: f"act_{uuid.uuid4().hex[:8]}")
    step: int = 0
    tool: str
    arguments: dict[str, Any] = Field(default_factory=dict)
    reason: str = ""
    expected_outcome: str = ""
    confidence: float = 0.0
    requires_approval: bool = False
    ts: str = Field(default_factory=lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
    result: dict[str, Any] | None = None
    cost: float = 0.0
    evidence: list[str] = Field(default_factory=list)


class ApprovalRequest(BaseModel):
    id: str = Field(default_factory=lambda: f"apr_{uuid.uuid4().hex[:8]}")
    action: str
    tool: str
    arguments: dict[str, Any] = Field(default_factory=dict)
    amount: float = 0.0
    reason: str = ""
    evidence: list[str] = Field(default_factory=list)
    status: Literal["awaiting_approval", "approved", "rejected", "expired"] = "awaiting_approval"
    ts: str = Field(default_factory=lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))


class CriticVerdict(BaseModel):
    valid: bool = True
    improved: bool = False
    should_retry: bool = False
    should_escalate: bool = False
    should_revise_plan: bool = False
    is_stalled: bool = False
    reason: str = ""
    suggested_next_tool: str | None = None


class AgentState(BaseModel):
    """Bounded open-ended controller state — wraps ReconState for canonical grouping."""
    goal: str = "reconcile"
    status: Literal["running", "complete", "blocked", "awaiting_approval"] = "running"
    step_count: int = 0
    max_steps: int = 60
    actions: list[AgentAction] = Field(default_factory=list)
    observations: list[Observation] = Field(default_factory=list)
    pending_approvals: list[ApprovalRequest] = Field(default_factory=list)
    completed_tools: set[str] = Field(default_factory=set)
    tool_call_counts: dict[str, int] = Field(default_factory=dict)
    last_unresolved_count: int | None = None
    stall_counter: int = 0
    seen_action_signatures: set[str] = Field(default_factory=set)
    blocked_reason: str | None = None

    model_config = {"arbitrary_types_allowed": True}

    # ReconState is kept as non-serialised companion for efficient union-find
    recon_state: Any = Field(default=None, exclude=True)
    meta: dict[str, Any] = Field(default_factory=dict)

    @property
    def recon(self) -> ReconState:
        return self.recon_state  # type: ignore[return-value]

    def goal_complete(self) -> bool:
        if self.status in ("complete", "blocked", "awaiting_approval"):
            return True
        unresolved = len(self.recon.unresolved()) if self.recon else 0
        covered = len(self.recon.matched_ids() | self.recon.exception_ids) if self.recon else 0
        total = len(self.recon.records) if self.recon else 0
        return total > 0 and unresolved == 0 and covered == total

    def is_blocked(self) -> bool:
        return self.status == "blocked"

    def record_action(self, action: AgentAction, result: dict[str, Any]) -> None:
        action.result = result
        action.step = self.step_count
        self.actions.append(action)
        self.completed_tools.add(action.tool)
        self.tool_call_counts[action.tool] = self.tool_call_counts.get(action.tool, 0) + 1
        sig = f"{action.tool}:{sorted(action.arguments.items())}"
        self.seen_action_signatures.add(sig)

    def pause_for_approval(self, approval: ApprovalRequest) -> None:
        self.pending_approvals.append(approval)
        self.status = "awaiting_approval"

    def approve(self, approval_id: str) -> bool:
        for a in self.pending_approvals:
            if a.id == approval_id and a.status == "awaiting_approval":
                a.status = "approved"
                self.status = "running"
                return True
        return False

    def reject(self, approval_id: str) -> bool:
        for a in self.pending_approvals:
            if a.id == approval_id and a.status == "awaiting_approval":
                a.status = "rejected"
                self.status = "blocked"
                self.blocked_reason = f"Approval {approval_id} rejected"
                return True
        return False

    def update_from_observation(self, obs: Observation) -> None:
        self.observations.append(obs)
        if self.last_unresolved_count is not None and obs.unresolved_count >= self.last_unresolved_count:
            self.stall_counter += 1
        elif self.last_unresolved_count is not None and obs.unresolved_count < self.last_unresolved_count:
            self.stall_counter = 0
        self.last_unresolved_count = obs.unresolved_count

    def apply_verdict(self, verdict: CriticVerdict) -> None:
        if verdict.is_stalled:
            self.stall_counter += 1

    def check_limits(self, policy) -> str | None:
        if self.step_count >= policy.execution.max_steps:
            self.status = "blocked"
            self.blocked_reason = f"max_steps {policy.execution.max_steps} reached"
            return self.blocked_reason
        if self.stall_counter >= policy.execution.stall_threshold_steps:
            self.status = "blocked"
            self.blocked_reason = f"progress stalled for {self.stall_counter} steps"
            return self.blocked_reason
        return None

    def to_trace(self) -> dict[str, Any]:
        return {
            "goal": self.goal,
            "status": self.status,
            "step_count": self.step_count,
            "max_steps": self.max_steps,
            "actions": [a.model_dump() for a in self.actions],
            "observations": [o.model_dump() for o in self.observations],
            "pending_approvals": [p.model_dump() for p in self.pending_approvals],
            "completed_tools": sorted(self.completed_tools),
            "tool_call_counts": self.tool_call_counts,
            "blocked_reason": self.blocked_reason,
        }
