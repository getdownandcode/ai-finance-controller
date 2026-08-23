"""Tool: inspect_sources — read-only workspace observation."""
from __future__ import annotations

from tools.handlers import handle_inspect_sources

NAME = "inspect_sources"
DESCRIPTION = "Inspect available sources, schemas, and record counts."
INPUT_SCHEMA = {"type": "object", "properties": {}, "required": []}
OUTPUT_SCHEMA = {"type": "object", "properties": {"source_counts": {"type": "object"}}}
COST = 0.1
RISK_LEVEL = "low"
REQUIRES_APPROVAL = False
CHANGES_EXTERNAL_STATE = False
HANDLER = handle_inspect_sources
