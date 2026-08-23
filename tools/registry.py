"""Central tool registry — planner chooses from declared tools, never hardcoded calls."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable


@dataclass(frozen=True)
class ToolDefinition:
    name: str
    description: str
    input_schema: dict[str, Any] = field(default_factory=dict)
    output_schema: dict[str, Any] = field(default_factory=dict)
    cost: float = 1.0
    risk_level: str = "low"  # low | medium | high
    requires_approval: bool = False
    changes_external_state: bool = False
    handler: Callable[..., Any] | None = None


_REGISTRY: dict[str, ToolDefinition] = {}


def register(tool: ToolDefinition) -> ToolDefinition:
    if tool.name in _REGISTRY:
        raise ValueError(f"Tool already registered: {tool.name}")
    _REGISTRY[tool.name] = tool
    return tool


def get(name: str) -> ToolDefinition | None:
    return _REGISTRY.get(name)


def all_tools() -> dict[str, ToolDefinition]:
    return dict(_REGISTRY)


def tool_names() -> list[str]:
    return sorted(_REGISTRY.keys())


def _lazy_register() -> None:
    if _REGISTRY:
        return
    # Import inside function to avoid circular deps
    from tools import handlers as H

    register(ToolDefinition(
        name="inspect_sources",
        description="Inspect available sources, schemas, and record counts without modifying state.",
        input_schema={"type": "object", "properties": {}, "required": []},
        output_schema={"type": "object", "properties": {"source_counts": {"type": "object"}, "schemas": {"type": "object"}}},
        cost=0.1, risk_level="low", requires_approval=False, changes_external_state=False,
        handler=H.handle_inspect_sources,
    ))
    register(ToolDefinition(
        name="normalize_records",
        description="Normalize and validate raw CSV records; idempotent.",
        input_schema={"type": "object", "properties": {"sources": {"type": "array"}}},
        output_schema={"type": "object", "properties": {"normalized_count": {"type": "integer"}}},
        cost=0.2, risk_level="low", requires_approval=False, changes_external_state=False,
        handler=H.handle_normalize_records,
    ))
    register(ToolDefinition(
        name="retrieve_candidates",
        description="Retrieve cross-source candidate pairs within date/amount windows.",
        input_schema={"type": "object", "properties": {"record_ids": {"type": "array", "items": {"type": "string"}}}},
        output_schema={"type": "object", "properties": {"candidates": {"type": "array"}}},
        cost=0.3, risk_level="low", requires_approval=False, changes_external_state=False,
        handler=H.handle_retrieve_candidates,
    ))
    register(ToolDefinition(
        name="exact_match",
        description="Tier-1 deterministic exact match: identical reference, amount, currency within date window.",
        input_schema={"type": "object", "properties": {"record_ids": {"type": "array", "items": {"type": "string"}}} },
        output_schema={"type": "object", "properties": {"merged": {"type": "integer"}}},
        cost=0.5, risk_level="low", requires_approval=False, changes_external_state=False,
        handler=H.handle_exact_match,
    ))
    register(ToolDefinition(
        name="fuzzy_match",
        description="Tier-2 fuzzy scoring: shared reference + tolerance + description similarity.",
        input_schema={"type": "object", "properties": {"record_ids": {"type": "array", "items": {"type": "string"}}}},
        output_schema={"type": "object", "properties": {"matched": {"type": "integer"}, "deferred": {"type": "integer"}}},
        cost=0.7, risk_level="low", requires_approval=False, changes_external_state=False,
        handler=H.handle_fuzzy_match,
    ))
    register(ToolDefinition(
        name="llm_reasoning",
        description="Tier-3 AI evidence reasoning over ambiguous candidate sets (fee-netting, settlement lag).",
        input_schema={"type": "object", "properties": {"record_ids": {"type": "array", "items": {"type": "string"}}}},
        output_schema={"type": "object", "properties": {"accepted": {"type": "integer"}, "escalated": {"type": "integer"}}},
        cost=3.0, risk_level="medium", requires_approval=False, changes_external_state=False,
        handler=H.handle_llm_reasoning,
    ))
    register(ToolDefinition(
        name="detect_duplicates",
        description="Detect same-source collisions that would form invalid groups (double-posts).",
        input_schema={"type": "object", "properties": {"record_id": {"type": "string"}}},
        output_schema={"type": "object", "properties": {"duplicates": {"type": "array"}}},
        cost=0.4, risk_level="low", requires_approval=False, changes_external_state=False,
        handler=H.handle_detect_duplicates,
    ))
    register(ToolDefinition(
        name="calculate_cash_position",
        description="Compute reconciled cash snapshot and exception exposure.",
        input_schema={"type": "object", "properties": {}},
        output_schema={"type": "object", "properties": {"confirmed_bank_cash": {"type": "number"}}},
        cost=0.2, risk_level="low", requires_approval=False, changes_external_state=False,
        handler=H.handle_calculate_cash_position,
    ))
    register(ToolDefinition(
        name="validate_reconciliation",
        description="Validate against ground truth and coverage invariants (no silent drops).",
        input_schema={"type": "object", "properties": {}},
        output_schema={"type": "object", "properties": {"coverage_ok": {"type": "boolean"}}},
        cost=0.3, risk_level="low", requires_approval=False, changes_external_state=False,
        handler=H.handle_validate_reconciliation,
    ))
    register(ToolDefinition(
        name="create_exception",
        description="Create an auditable exception for an unresolved record with reason and action.",
        input_schema={"type": "object", "properties": {"record_id": {"type": "string"}}},
        output_schema={"type": "object", "properties": {"exception": {"type": "object"}}},
        cost=0.3, risk_level="low", requires_approval=False, changes_external_state=False,
        handler=H.handle_create_exception,
    ))
    register(ToolDefinition(
        name="generate_report",
        description="Produce markdown/JSON/CSV audit pack for the current reconciliation.",
        input_schema={"type": "object", "properties": {}},
        output_schema={"type": "object", "properties": {"reports": {"type": "array"}}},
        cost=0.2, risk_level="low", requires_approval=False, changes_external_state=False,
        handler=H.handle_generate_report,
    ))
    # Controlled finance actions — proposal only by default
    register(ToolDefinition(
        name="propose_journal_entry",
        description="Propose a journal entry to explain a reconciliation difference (awaiting approval).",
        input_schema={"type": "object", "properties": {"amount": {"type": "number"}, "reason": {"type": "string"}, "evidence": {"type": "array"}}},
        output_schema={"type": "object", "properties": {"approval_id": {"type": "string"}}},
        cost=1.0, risk_level="high", requires_approval=True, changes_external_state=True,
        handler=H.handle_propose_journal_entry,
    ))
    register(ToolDefinition(
        name="propose_cash_adjustment",
        description="Propose a cash adjustment (awaiting approval).",
        input_schema={"type": "object", "properties": {"amount": {"type": "number"}, "reason": {"type": "string"}}},
        output_schema={"type": "object", "properties": {"approval_id": {"type": "string"}}},
        cost=1.0, risk_level="high", requires_approval=True, changes_external_state=True,
        handler=H.handle_propose_cash_adjustment,
    ))
    register(ToolDefinition(
        name="request_review",
        description="Request human review for an ambiguous match or high-value exception.",
        input_schema={"type": "object", "properties": {"record_id": {"type": "string"}, "reason": {"type": "string"}}},
        output_schema={"type": "object", "properties": {"approval_id": {"type": "string"}}},
        cost=0.2, risk_level="low", requires_approval=False, changes_external_state=False,
        handler=H.handle_request_review,
    ))
    register(ToolDefinition(
        name="mark_reconciled",
        description="Mark a validated group as reconciled (no external write without approval).",
        input_schema={"type": "object", "properties": {"group_id": {"type": "string"}}},
        output_schema={"type": "object", "properties": {"marked": {"type": "boolean"}}},
        cost=0.3, risk_level="medium", requires_approval=True, changes_external_state=True,
        handler=H.handle_mark_reconciled,
    ))
    register(ToolDefinition(
        name="export_reconciliation",
        description="Export final payload for ERP write-back (requires approval if allow_external_writes).",
        input_schema={"type": "object", "properties": {}},
        output_schema={"type": "object", "properties": {"exported": {"type": "boolean"}}},
        cost=0.4, risk_level="high", requires_approval=True, changes_external_state=True,
        handler=H.handle_export_reconciliation,
    ))


def ensure_registered() -> dict[str, ToolDefinition]:
    _lazy_register()
    return all_tools()
