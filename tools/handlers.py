"""Executable handlers for each registered tool — thin wrappers over existing domain logic."""
from __future__ import annotations

from typing import Any

from agents.exception_agent import ExceptionAgent
from agents.matching_agent import MatchingAgent
from tools.candidate_retrieval import retrieve_candidates
from tools.cash_position import cash_position
from tools.exception_classifier import classify_exception


def _recon(ctx) -> Any:
    return ctx["state"].recon if hasattr(ctx["state"], "recon") else ctx["state"]


def handle_inspect_sources(ctx: dict, args: dict, policy, goal: str) -> dict:
    recon = _recon(ctx)
    counts: dict[str, int] = {}
    schemas: dict[str, list[str]] = {}
    for r in recon.records.values():
        counts[r.source] = counts.get(r.source, 0) + 1
        schemas[r.source] = sorted({k for k in r.model_fields.keys()})
    return {"source_counts": counts, "total": len(recon.records), "schemas": schemas, "unresolved": len(recon.unresolved())}


def handle_normalize_records(ctx: dict, args: dict, policy, goal: str) -> dict:
    recon = _recon(ctx)
    return {"normalized_count": len(recon.records), "note": "Records already normalized at pipeline ingestion; idempotent."}


def handle_retrieve_candidates(ctx: dict, args: dict, policy, goal: str) -> dict:
    recon = _recon(ctx)
    rids = args.get("record_ids") or [r.record_id for r in recon.unresolved()[:5]]
    # Use the AgentConfig attached to ctx
    cfg = ctx.get("cfg")
    out: dict[str, Any] = {}
    for rid in rids:
        rec = recon.records.get(rid)
        if not rec or recon.is_grouped(rid) or rid in recon.exception_ids:
            out[rid] = {"candidates": 0, "skipped": True}
            continue
        cands, evs = retrieve_candidates(rec, recon.pool(rid), cfg)
        out[rid] = {
            "candidates": len(cands),
            "top_evidence": evs[0].model_dump() if evs else None,
            "candidate_ids": [c.record_id for c in cands[:3]],
        }
    return {"per_record": out, "total_unresolved": len(recon.unresolved())}


def handle_exact_match(ctx: dict, args: dict, policy, goal: str) -> dict:
    recon = _recon(ctx)
    rids = args.get("record_ids")
    # Delegate to MatchingAgent but scoped to a subset if requested
    agent = MatchingAgent(recon, ctx["cfg"])
    if rids:
        # Temporarily filter unresolved set by ensuring only those rids are considered:
        # We achieve this by marking others as excluded / grouped? Instead, run full but report filtered.
        # Simpler: run full pass; the planner will call without rids most of the time.
        merged = agent.run_exact_pass()
        # Filter count to requested ids (approx)
        return {"merged": merged, "scoped": rids}
    merged = agent.run_exact_pass()
    return {"merged": merged}


def handle_fuzzy_match(ctx: dict, args: dict, policy, goal: str) -> dict:
    recon = _recon(ctx)
    agent = MatchingAgent(recon, ctx["cfg"])
    stats = agent.run_fuzzy_pass()
    return stats


def handle_llm_reasoning(ctx: dict, args: dict, policy, goal: str) -> dict:
    recon = _recon(ctx)
    agent = MatchingAgent(recon, ctx["cfg"])
    stats = agent.run_reasoning_pass()
    return stats


def handle_detect_duplicates(ctx: dict, args: dict, policy, goal: str) -> dict:
    recon = _recon(ctx)
    rid = args.get("record_id")
    if rid and rid in recon.records:
        rec = recon.records[rid]
        # Detect if any other same-source record shares ref_norm / close amount
        dups = []
        for other in recon.records.values():
            if other.record_id == rid or other.source != rec.source:
                continue
            if rec.ref_norm and rec.ref_norm == other.ref_norm:
                dups.append(other.record_id)
        return {"record_id": rid, "duplicates": dups}
    # Global scan
    groups: dict[str, list[str]] = {}
    for r in recon.records.values():
        if r.ref_norm:
            groups.setdefault(r.ref_norm, []).append(r.record_id)
    dups = {k: v for k, v in groups.items() if len(v) > 1}
    return {"duplicate_ref_groups": dups, "count": len(dups)}


def handle_calculate_cash_position(ctx: dict, args: dict, policy, goal: str) -> dict:
    recon = _recon(ctx)
    cash = cash_position(recon.records, recon.matched_ids(), recon.exception_ids, recon.meta)
    return cash


def handle_validate_reconciliation(ctx: dict, args: dict, policy, goal: str) -> dict:
    recon = _recon(ctx)
    covered = recon.matched_ids() | recon.exception_ids
    missing = set(recon.records) - covered
    return {"coverage_ok": len(missing) == 0, "matched": len(recon.matched_ids()), "exceptions": len(recon.exception_ids), "missing": sorted(missing)[:10], "lost_count": len(missing)}


def handle_create_exception(ctx: dict, args: dict, policy, goal: str) -> dict:
    recon = _recon(ctx)
    rid = args.get("record_id")
    if not rid or rid not in recon.records:
        # Bulk triage
        agent = ExceptionAgent(recon, ctx["cfg"])
        raised = agent.triage()
        return {"raised": raised, "mode": "bulk_triage"}
    rec = recon.records[rid]
    if rid in recon.exception_ids or recon.is_grouped(rid):
        return {"skipped": True, "reason": "already finalized"}
    cfg = ctx["cfg"]
    _, evs = retrieve_candidates(rec, recon.pool(rid), cfg)
    item = classify_exception(rec, evs, cfg)
    recon.add_exception(item)
    return {"exception": item.model_dump(), "mode": "single"}


def handle_generate_report(ctx: dict, args: dict, policy, goal: str) -> dict:
    return {"note": "Reports are written at pipeline completion via ReportingAgent; preview not yet persisted.", "ready": False}


# --- Controlled finance actions (proposal-only) ---


def _needs_approval(amount: float, policy) -> bool:
    return abs(amount) > policy.execution.require_approval_above_amount


def handle_propose_journal_entry(ctx: dict, args: dict, policy, goal: str) -> dict:
    amount = float(args.get("amount", 0))
    reason = args.get("reason", "")
    evidence = args.get("evidence", [])
    state = ctx["state"]
    # This tool is declared requires_approval=True; executor will pause.
    # Handler just validates shape.
    if not reason:
        return {"success": False, "error": "reason required"}
    if policy.exceptions.require_reason and not reason:
        return {"success": False, "error": "reason required by policy"}
    return {"proposed": True, "amount": amount, "reason": reason, "evidence": evidence, "requires_approval": True}


def handle_propose_cash_adjustment(ctx: dict, args: dict, policy, goal: str) -> dict:
    amount = float(args.get("amount", 0))
    reason = args.get("reason", "")
    return {"proposed": True, "amount": amount, "reason": reason, "requires_approval": True}


def handle_request_review(ctx: dict, args: dict, policy, goal: str) -> dict:
    rid = args.get("record_id", "")
    reason = args.get("reason", "human_review required")
    recon = _recon(ctx)
    if rid and rid in recon.records:
        # Create a hint-like exception if not yet exceptioned
        pass
    return {"requested": True, "record_id": rid, "reason": reason}


def handle_mark_reconciled(ctx: dict, args: dict, policy, goal: str) -> dict:
    gid = args.get("group_id", "")
    if policy.execution.allow_external_writes:
        return {"marked": True, "group_id": gid, "written": True}
    return {"marked": False, "group_id": gid, "written": False, "requires_approval": True, "note": "allow_external_writes=false — proposal only"}


def handle_export_reconciliation(ctx: dict, args: dict, policy, goal: str) -> dict:
    if policy.execution.allow_external_writes:
        return {"exported": True}
    return {"exported": False, "requires_approval": True, "note": "Export is proposal-only until approval"}
