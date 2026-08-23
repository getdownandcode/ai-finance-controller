"""Tool: generate_report."""
from tools.handlers import handle_generate_report

NAME = "generate_report"
DESCRIPTION = "Produce markdown/JSON/CSV audit pack."
INPUT_SCHEMA = {"type": "object", "properties": {}}
OUTPUT_SCHEMA = {"type": "object", "properties": {"reports": {"type": "array"}}}
COST = 0.2
RISK_LEVEL = "low"
REQUIRES_APPROVAL = False
CHANGES_EXTERNAL_STATE = False
HANDLER = handle_generate_report
