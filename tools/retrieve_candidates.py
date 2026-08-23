"""Tool: retrieve_candidates — thin wrapper to preserve registry discoverability."""
from tools.candidate_retrieval import Evidence, retrieve_candidates as _retrieve  # noqa: F401
from tools.handlers import handle_retrieve_candidates

NAME = "retrieve_candidates"
DESCRIPTION = "Retrieve cross-source candidates within date/amount windows."
INPUT_SCHEMA = {"type": "object", "properties": {"record_ids": {"type": "array", "items": {"type": "string"}}}}
OUTPUT_SCHEMA = {"type": "object", "properties": {"candidates": {"type": "array"}}}
COST = 0.3
RISK_LEVEL = "low"
REQUIRES_APPROVAL = False
CHANGES_EXTERNAL_STATE = False
HANDLER = handle_retrieve_candidates
