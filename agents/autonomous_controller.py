"""Autonomous controller — goal -> observe -> plan -> act -> reflect."""
from __future__ import annotations

import logging
import time

from agents.controller_agent import AgentConfig, ReconState
from agents.critic_agent import CriticAgent
from agents.observer_agent import ObserverAgent
from agents.planner_agent import PlannerAgent
from agents.state import AgentAction, AgentState, ApprovalRequest
from config.policy_loader import Policy
from tools.registry import ensure_registered

log = logging.getLogger(__name__)


class AutonomousController:
    def __init__(
        self,
        records: dict,
        meta: dict,
        policy: Policy | None = None,
        goal: str = "reconcile",
        cfg: AgentConfig | None = None,
    ):
        self.policy = policy or Policy.load()
        overrides = self.policy.overrides_for_agent_config()
        base_cfg = cfg or AgentConfig()
        # Apply policy overrides
        self.cfg = AgentConfig(
            fuzzy_accept=overrides["fuzzy_accept"],
            llm_accept=overrides["llm_accept"],
            near_tie=overrides["near_tie"],
            fuzzy_date_window=overrides["fuzzy_date_window"],
            retrieve_date_window=overrides["retrieve_date_window"],
            retrieve_amount_pct=overrides["retrieve_amount_pct"],
            llm_mode=overrides["llm_mode"] if base_cfg.llm_mode == "auto" else base_cfg.llm_mode,
        )
        # Stash cfg for handlers that need retrieve windows
        meta = dict(meta)
        meta["_cfg"] = self.cfg

        recon = ReconState(records, meta)
        self.state = AgentState(
            goal=goal,
            status="running",
            max_steps=self.policy.execution.max_steps,
            recon_state=recon,
            meta=meta,
        )
        # Attach cfg to context for tools
        self.ctx = {"state": self.state, "cfg": self.cfg, "policy": self.policy, "goal": goal}
        self.tools = ensure_registered()
        self.observer = ObserverAgent()
        self.planner = PlannerAgent(self.policy)
        self.critic = CriticAgent()
        self.goal = goal

    def _requires_approval(self, tool_name: str, args: dict, result_preview: dict | None = None) -> bool:
        tool = self.tools.get(tool_name)
        if not tool:
            return False
        if tool.requires_approval:
            # Controlled finance actions always require approval
            if tool.changes_external_state and not self.policy.execution.allow_external_writes:
                return True
            if tool_name in ("propose_journal_entry", "propose_cash_adjustment", "mark_reconciled", "export_reconciliation"):
                return True
            return True
        # Amount-based gate
        amount = None
        if "amount" in args:
            amount = abs(float(args["amount"]))
        elif result_preview and "amount" in result_preview:
            amount = abs(float(result_preview["amount"]))
        if amount is not None and amount > self.policy.execution.require_approval_above_amount:
            return True
        return False

    def _execute_tool(self, tool_name: str, args: dict) -> dict:
        tool = self.tools.get(tool_name)
        if not tool or not tool.handler:
            return {"success": False, "error": f"Unknown tool: {tool_name}", "_tool": tool_name}
        before = len(self.state.recon.unresolved())
        try:
            # Handlers are allowed to accept bulk record_ids; normalize
            if tool_name == "create_exception" and "record_ids" in args:
                # Expand bulk into per-record calls aggregated
                raised = 0
                details = []
                for rid in args["record_ids"]:
                    r = tool.handler(self.ctx, {"record_id": rid}, self.policy, self.goal)
                    raised += 1 if r.get("exception") else 0
                    details.append(r)
                data = {"raised": raised, "details": details}
                return {"success": True, "_tool": tool_name, "_before_unresolved": before, **data}
            # Also support bulk for other tools via handler's own logic
            data = tool.handler(self.ctx, args, self.policy, self.goal)
            if isinstance(data, dict):
                data = {"success": True, "_tool": tool_name, "_before_unresolved": before, **data}
            else:
                data = {"success": True, "_tool": tool_name, "_before_unresolved": before, "data": data}
            return data
        except Exception as exc:
            log.exception("Tool %s failed", tool_name)
            return {"success": False, "error": str(exc), "_tool": tool_name, "_before_unresolved": before}

    def run(self) -> AgentState:
        recon = self.state.recon
        recon.log("autonomous", "goal_received", goal=self.goal, policy=self.policy.model_dump())

        # Initial observation
        self.state.step_count = 0

        while not self.state.goal_complete():
            # Guard: max steps
            limit_reason = self.state.check_limits(self.policy)
            if limit_reason:
                recon.log("autonomous", "limit_reached", reason=limit_reason, steps=self.state.step_count)
                break

            observation = self.observer.inspect(self.state, self.policy, self.cfg)
            self.state.update_from_observation(observation)

            # Planner decides next action
            action_spec = self.planner.choose_next_action(observation, self.tools, self.policy, self.state, self.goal)
            if action_spec is None:
                # No more actions but still unresolved? This is a bug — verify coverage via triage fallback
                if observation.unresolved_count > 0:
                    action_spec = {
                        "action": "create_exception",
                        "arguments": {"record_ids": [r.record_id for r in recon.unresolved()[:10]]},
                        "reason": "Planner returned None but unresolved remains — forcing triage.",
                        "expected_outcome": "Exceptions",
                        "confidence": 0.75,
                    }
                else:
                    break

            tool_name = action_spec["action"]
            args = action_spec.get("arguments", {})
            reason = action_spec.get("reason", "")
            expected = action_spec.get("expected_outcome", "")
            confidence = float(action_spec.get("confidence", 0.0))

            # Safeguard: no repeated identical actions
            sig = f"{tool_name}:{sorted(args.items())}"
            if self.policy.execution.no_repeat_identical_actions and sig in self.state.seen_action_signatures:
                recon.log("autonomous", "skip_repeat_action", tool=tool_name, args=args)
                # Force revision: try to get alternative
                # Mark as seen already, so planner will need to return different args next iteration
                # If planner keeps returning same, we will stall and exit via stall guard
                self.state.stall_counter += 1
                continue

            # Safeguard: no action on already finalized records
            if self.policy.execution.no_action_on_finalized_records and tool_name in ("exact_match", "fuzzy_match", "llm_reasoning", "create_exception"):
                if "record_id" in args and args["record_id"] in (recon.matched_ids() | recon.exception_ids):
                    recon.log("autonomous", "skip_finalized", tool=tool_name, record=args["record_id"])
                    self.state.stall_counter += 1
                    continue
                if "record_ids" in args:
                    filtered = [rid for rid in args["record_ids"] if rid not in (recon.matched_ids() | recon.exception_ids) and not recon.is_grouped(rid)]
                    if not filtered:
                        recon.log("autonomous", "skip_all_finalized", tool=tool_name)
                        self.state.stall_counter += 1
                        continue
                    args = {**args, "record_ids": filtered}

            # Safeguard: max retries per tool
            if tool_name in ("exact_match", "fuzzy_match") and self.state.tool_call_counts.get(tool_name, 0) >= self.policy.execution.max_retries_per_tool:
                recon.log("autonomous", "skip_retry_budget", tool=tool_name, count=self.state.tool_call_counts.get(tool_name))
                self.state.stall_counter += 1
                continue
            if tool_name == "llm_reasoning" and self.state.tool_call_counts.get(tool_name, 0) >= self.policy.execution.max_llm_calls:
                recon.log("autonomous", "skip_llm_budget", count=self.state.tool_call_counts.get(tool_name))
                # Do not stall indefinitely — escalate
                tool_name = "create_exception"
                args = {"record_ids": [r.record_id for r in recon.unresolved()[:10]]}
                reason = "LLM budget exhausted; escalating to exceptions."

            # Approval gate (before execution)
            # For planning, we can predict approval need without running
            if self._requires_approval(tool_name, args):
                approval = ApprovalRequest(
                    action=tool_name,
                    tool=tool_name,
                    arguments=args,
                    amount=float(args.get("amount", 0)),
                    reason=reason or f"Tool {tool_name} requires approval per policy",
                    evidence=args.get("evidence", []),
                )
                self.state.pause_for_approval(approval)
                recon.log("autonomous", "awaiting_approval", tool=tool_name, approval_id=approval.id, reason=reason)
                break

            # Execute
            self.state.step_count += 1
            action = AgentAction(
                step=self.state.step_count,
                tool=tool_name,
                arguments=args,
                reason=reason,
                expected_outcome=expected,
                confidence=confidence,
                requires_approval=False,
            )
            # Pre-log intent
            recon.log("autonomous", "action_start", step=self.state.step_count, tool=tool_name, args=args, reason=reason, confidence=confidence)

            result = self._execute_tool(tool_name, args)
            # Tool metadata for critic
            result["_step"] = self.state.step_count

            # Record
            cost = self.tools[tool_name].cost if tool_name in self.tools else 1.0
            action.cost = cost
            self.state.record_action(action, result)

            # Critic
            verdict = self.critic.evaluate(result, self.state, self.policy)
            self.state.apply_verdict(verdict)
            recon.log("autonomous", "action_end", step=self.state.step_count, tool=tool_name, result=result, verdict=verdict.model_dump())

            # Check stall / blocked
            limit_reason = self.state.check_limits(self.policy)
            if limit_reason:
                break

            # If critic says should_revise but next iteration will handle via observation, just loop
            # Small yield to avoid tight loop burning LLM budget
            if tool_name == "llm_reasoning":
                time.sleep(0.01)

        # Final verification: no silent drops
        covered = recon.matched_ids() | recon.exception_ids
        missing = set(recon.records) - covered
        if missing and self.state.status not in ("awaiting_approval", "blocked"):
            # Force triage for any stragglers (should not happen via plan)
            recon.log("autonomous", "final_triage_for_missing", missing=sorted(missing)[:10])
            from agents.exception_agent import ExceptionAgent
            agent = ExceptionAgent(recon, self.cfg)
            agent.triage()
            # Re-check
            covered = recon.matched_ids() | recon.exception_ids
            missing = set(recon.records) - covered
            assert not missing, f"Records lost without trace: {missing}"

        if self.state.status == "running":
            if not missing:
                self.state.status = "complete"
                recon.log("autonomous", "goal_complete", goal=self.goal, steps=self.state.step_count)

        recon.log("autonomous", "run_finished", status=self.state.status, steps=self.state.step_count,
                  matched=len(recon.matched_ids()), exceptions=len(recon.exception_ids),
                  blocked_reason=self.state.blocked_reason)
        return self.state
