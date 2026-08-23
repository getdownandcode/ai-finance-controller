"""Controlled action: propose cash adjustment."""
from tools.handlers import handle_propose_cash_adjustment as handler

NAME = "propose_cash_adjustment"
REQUIRES_APPROVAL = True
CHANGES_EXTERNAL_STATE = True
RISK = "high"
