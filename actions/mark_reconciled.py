"""Controlled action: mark reconciled (requires approval if external writes disabled)."""
from tools.handlers import handle_mark_reconciled as handler

NAME = "mark_reconciled"
REQUIRES_APPROVAL = True
CHANGES_EXTERNAL_STATE = True
