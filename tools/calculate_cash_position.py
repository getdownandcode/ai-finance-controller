"""Tool: calculate_cash_position."""
from tools.cash_position import cash_position  # noqa: F401
from tools.handlers import handle_calculate_cash_position

NAME = "calculate_cash_position"
DESCRIPTION = "Compute reconciled cash snapshot and exception exposure."
INPUT_SCHEMA = {"type": "object", "properties": {}}
OUTPUT_SCHEMA = {"type": "object", "properties": {"confirmed_bank_cash": {"type": "number"}}}
COST = 0.2
RISK_LEVEL = "low"
REQUIRES_APPROVAL = False
CHANGES_EXTERNAL_STATE = False
HANDLER = handle_calculate_cash_position
