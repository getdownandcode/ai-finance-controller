"""Controlled action: propose journal entry (proposal-only until approval)."""
from __future__ import annotations

from pydantic import BaseModel

from tools.handlers import handle_propose_journal_entry as handler  # re-export

NAME = "propose_journal_entry"
REQUIRES_APPROVAL = True
CHANGES_EXTERNAL_STATE = True
RISK = "high"


class JournalEntryProposal(BaseModel):
    action: str = "propose_journal_entry"
    status: str = "awaiting_approval"
    amount: float
    reason: str
    evidence: list[str] = []
