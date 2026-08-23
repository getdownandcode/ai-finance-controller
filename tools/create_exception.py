"""Tool: create_exception."""
from tools.handlers import handle_create_exception

NAME = "create_exception"
DESCRIPTION = "Create an auditable exception for an unresolved record."
INPUT_SCHEMA = {"type": "object", "properties": {"record_id": {"type": "string"}}}
OUTPUT_SCHEMA = {"type": "object", "properties": {"exception": {"type": "object"}}}
COST = 0.3
RISK_LEVEL = "low"
REQUIRES_APPROVAL = False
CHANGES_EXTERNAL_STATE = False
HANDLER = handle_create_exception
