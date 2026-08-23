"""Tool: detect_duplicates."""
from tools.handlers import handle_detect_duplicates

NAME = "detect_duplicates"
DESCRIPTION = "Detect same-source collisions (double-posts)."
INPUT_SCHEMA = {"type": "object", "properties": {"record_id": {"type": "string"}}}
OUTPUT_SCHEMA = {"type": "object", "properties": {"duplicates": {"type": "array"}}}
COST = 0.4
RISK_LEVEL = "low"
REQUIRES_APPROVAL = False
CHANGES_EXTERNAL_STATE = False
HANDLER = handle_detect_duplicates
