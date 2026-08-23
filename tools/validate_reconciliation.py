"""Tool: validate_reconciliation."""
from tools.handlers import handle_validate_reconciliation

NAME = "validate_reconciliation"
DESCRIPTION = "Validate coverage invariants and ground-truth consistency."
INPUT_SCHEMA = {"type": "object", "properties": {}}
OUTPUT_SCHEMA = {"type": "object", "properties": {"coverage_ok": {"type": "boolean"}}}
COST = 0.3
RISK_LEVEL = "low"
REQUIRES_APPROVAL = False
CHANGES_EXTERNAL_STATE = False
HANDLER = handle_validate_reconciliation
