"""Controlled action: request human review."""
from tools.handlers import handle_request_review as handler

NAME = "request_review"
REQUIRES_APPROVAL = False
CHANGES_EXTERNAL_STATE = False
RISK = "low"
