"""Tool: normalize_records — idempotent normalization."""
from tools.handlers import handle_normalize_records

NAME = "normalize_records"
DESCRIPTION = "Normalize and validate raw CSV records."
INPUT_SCHEMA = {"type": "object", "properties": {"sources": {"type": "array"}}}
OUTPUT_SCHEMA = {"type": "object", "properties": {"normalized_count": {"type": "integer"}}}
COST = 0.2
RISK_LEVEL = "low"
REQUIRES_APPROVAL = False
CHANGES_EXTERNAL_STATE = False
HANDLER = handle_normalize_records
