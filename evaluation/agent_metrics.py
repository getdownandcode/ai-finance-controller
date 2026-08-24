"""Agent behavior metrics — beyond match accuracy."""
from __future__ import annotations

from typing import Any


def compute_agent_metrics(agent_state, recon_state, metrics: dict, cash: dict, policy) -> dict[str, Any]:
    total = metrics.get("total_records", 0)
    matched = metrics.get("matched_records", 0)
    exceptions = metrics.get("exceptions", 0)
    raw_rate = metrics.get("raw_match_rate", 0)
    f1 = metrics.get("f1")
    precision = metrics.get("precision")
    recall = metrics.get("recall")

    steps = agent_state.step_count
    # coverage already includes exceptions — goal complete iff no missing
    covered_ids = recon_state.matched_ids() | recon_state.exception_ids
    covered = len(covered_ids)
    goal_complete = 1.0 if (total > 0 and covered >= total) else 0.0

    # Exception recall not applicable without gt, but we report rate
    valid_actions = sum(1 for a in agent_state.actions if a.result and a.result.get("success"))
    tool_counts = agent_state.tool_call_counts
    total_tool_calls = len(agent_state.actions)
    unnecessary = max(0, total_tool_calls - steps)  # steps == actions normally, so 0

    # Cost per batch: sum of tool costs
    from tools.registry import all_tools
    tools_meta = all_tools()
    total_cost = sum(tools_meta.get(a.tool, type("_", (), {"cost": 1})()).cost if hasattr(tools_meta.get(a.tool), "cost") else a.cost for a in agent_state.actions) if agent_state.actions else 0.0

    # Actions with evidence (have reason/expected_outcome)
    with_evidence = sum(1 for a in agent_state.actions if a.reason)

    # Approval rate
    pending = len([p for p in agent_state.pending_approvals if p.status == "awaiting_approval"])
    approved = len([p for p in agent_state.pending_approvals if p.status == "approved"])
    approval_rate = (pending + approved) / max(1, len(agent_state.pending_approvals)) if agent_state.pending_approvals else 0.0

    # Silent-drop rate — should be 0
    missing = max(0, total - covered) if total else 0
    silent_drop_rate = missing / total if total else 0.0

    # Efficiency: steps per record
    steps_per_record = steps / total if total else 0.0

    return {
        "agent_goal": agent_state.goal,
        "agent_status": agent_state.status,
        "agent_steps": steps,
        "agent_goal_complete_rate": goal_complete,
        "agent_coverage": round(min(1.0, covered / total), 4) if total else 1.0,
        "agent_steps_per_record": round(steps_per_record, 3),
        "agent_total_cost": round(total_cost, 2),
        "agent_tool_calls": total_tool_calls,
        "agent_tool_counts": tool_counts,
        "agent_unnecessary_calls": unnecessary,
        "agent_with_evidence_pct": round(with_evidence / max(1, total_tool_calls), 3),
        "agent_pending_approvals": pending,
        "agent_approval_rate": round(approval_rate, 3),
        "agent_silent_drop_rate": round(silent_drop_rate, 4),
        "agent_stall_counter": agent_state.stall_counter,
        "agent_blocked_reason": agent_state.blocked_reason,
        # Preserve original accuracy under same keys for comparison
        "validated_match_rate": metrics.get("validated_match_rate"),
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "raw_match_rate": raw_rate,
    }
