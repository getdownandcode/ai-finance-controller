from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, Field

log = logging.getLogger(__name__)

DEFAULT_POLICY_PATH = Path(__file__).with_name("policy.yaml")


class MatchingPolicy(BaseModel):
    exact_match_confidence: float = 1.0
    fuzzy_match_confidence: float = 0.90
    llm_match_confidence: float = 0.80
    near_tie_threshold: float = 0.05
    fuzzy_date_window_days: int = 3
    retrieve_date_window_days: int = 6
    retrieve_amount_pct: float = 0.08
    max_date_difference_days: int = 6


class ExecutionPolicy(BaseModel):
    max_steps: int = 60
    max_retries_per_tool: int = 2
    max_llm_calls: int = 8
    max_llm_tokens: int = 50000
    allow_external_writes: bool = False
    require_approval_above_amount: float = 5000.0
    require_approval_for_journal_entry: bool = True
    require_approval_for_cash_adjustment: bool = True
    stall_threshold_steps: int = 4
    no_repeat_identical_actions: bool = True
    no_action_on_finalized_records: bool = True


class ExceptionsPolicy(BaseModel):
    require_reason: bool = True
    require_recommended_action: bool = True
    require_explanation: bool = True
    valid_reasons: list[str] = Field(default_factory=lambda: [
        "POSSIBLE_DUPLICATE", "DUPLICATE_CANDIDATE", "LOW_CONFIDENCE",
        "NO_COUNTERPART", "AMOUNT_MISMATCH", "CURRENCY_MISMATCH",
        "DATE_OUT_OF_WINDOW", "MISSING_REFERENCE", "TOOL_ERROR",
    ])


class ApprovalsPolicy(BaseModel):
    auto_approve_below_amount: float = 0.0
    expiry_hours: int = 24


class AuditPolicy(BaseModel):
    require_complete_trace: bool = True
    preserve_action_history: bool = True


class Policy(BaseModel):
    matching: MatchingPolicy = Field(default_factory=MatchingPolicy)
    execution: ExecutionPolicy = Field(default_factory=ExecutionPolicy)
    exceptions: ExceptionsPolicy = Field(default_factory=ExceptionsPolicy)
    approvals: ApprovalsPolicy = Field(default_factory=ApprovalsPolicy)
    audit: AuditPolicy = Field(default_factory=AuditPolicy)

    @classmethod
    def load(cls, path: str | Path | None = None) -> "Policy":
        p = Path(path) if path else DEFAULT_POLICY_PATH
        if not p.exists():
            log.warning("Policy file %s not found — using defaults", p)
            return cls()
        try:
            raw: dict[str, Any] = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
            return cls.model_validate(raw)
        except Exception as exc:
            log.warning("Failed to parse %s: %s — using defaults", p, exc)
            return cls()

    def overrides_for_agent_config(self) -> dict[str, Any]:
        return {
            "fuzzy_accept": self.matching.fuzzy_match_confidence,
            "llm_accept": self.matching.llm_match_confidence,
            "near_tie": self.matching.near_tie_threshold,
            "fuzzy_date_window": self.matching.fuzzy_date_window_days,
            "retrieve_date_window": self.matching.retrieve_date_window_days,
            "retrieve_amount_pct": self.matching.retrieve_amount_pct,
            "llm_mode": "auto",
        }
