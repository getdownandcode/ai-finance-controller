"""Tier 3 — reasoning over ambiguous candidate sets.

Two interchangeable reasoners behind one interface:

* gemini         : real LLM call with structured batch reasoning, eliminating
                   per-request latency and free-tier rate limit bottlenecks.
* deterministic  : an encoded domain-policy reasoner (card-fee patterns,
                   settlement windows, entity-name overlap, near-tie
                   detection). It is clearly labelled in every report so no
                   result is ever passed off as LLM output.
"""
from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.request
from typing import Any

from dotenv import load_dotenv
load_dotenv()

from pydantic import BaseModel, Field

from tools.candidate_retrieval import Evidence
from tools.normalize import Record, desc_text

LLM_ACCEPT = 0.80

FEE_PATTERNS = [(0.029, 0.30), (0.030, 0.00), (0.025, 0.00), (0.015, 0.00)]
STOPWORDS = {"settlement", "payment", "invoice", "payout", "credit", "debit",
             "card", "net", "gross", "fees", "fee", "stripe", "ach", "wire",
             "misc", "corp", "llc", "the", "and", "of", "for", "accounts",
             "receivable", "payable", "post", "duplicate", "batch"}


class LLMResult(BaseModel):
    decision: str                        # match | no_match | escalate | error
    selected_candidate_id: str | None = None
    confidence: float = 0.0
    reason: str = ""
    missing_evidence: str = ""
    reasoner: str = "deterministic"


def resolve_mode(cfg) -> str:
    if cfg.llm_mode == "off":
        return "deterministic"
    if cfg.llm_mode in ("gemini", "anthropic"):
        return "gemini"
    # Auto mode: if GEMINI_API_KEY is found in environment or .env, use Gemini
    return "gemini" if os.environ.get("GEMINI_API_KEY") else "deterministic"


# --------------------------------------------------------------------------
# Deterministic domain-policy reasoner (fallback / offline; fully auditable)
# --------------------------------------------------------------------------

def _sig_tokens(rec: Record) -> set[str]:
    words = set(re.findall(r"[a-z]{4,}", desc_text(rec).lower()))
    return words - STOPWORDS


def _deterministic_reason(record: Record, candidates: list[Record], evidences: list[Evidence], cfg) -> LLMResult:
    scored = []
    for cand, ev in zip(candidates, evidences):
        s, why = 0.0, []
        for rate, fixed in FEE_PATTERNS:
            expected = cand.amount * (1 - rate) - fixed
            if abs(record.amount - expected) <= 0.05:
                s += 0.60
                why.append(f"amount equals {cand.record_id} net of {rate*100:.1f}% + ${fixed:.2f} fee")
                break
        if abs(record.amount - cand.amount) <= 0.005:
            s += 0.55
            why.append("identical amount")
        elif ev.amount_within_tol:
            s += 0.25
            why.append("amount within tolerance")
        toks = _sig_tokens(record) & _sig_tokens(cand)
        if toks:
            s += 0.20
            why.append("entity/description term overlap: " + ", ".join(sorted(toks)[:3]))
        if ev.date_diff_days <= 3:
            s += 0.15
        elif ev.date_diff_days <= 5:
            s += 0.08
        scored.append((round(s, 3), cand, why))

    if not scored:
        return LLMResult(decision="no_match", selected_candidate_id=None,
                         confidence=0.0, reason="No candidates available.", reasoner="deterministic")

    scored.sort(key=lambda t: -t[0])
    top_s, top_c, top_why = scored[0]

    # Near-tie guard: two candidates with indistinguishable evidence.
    if len(scored) > 1:
        sec_s, sec_c, _ = scored[1]
        if sec_s >= 0.60 and top_s - sec_s < cfg.near_tie:
            return LLMResult(
                decision="escalate", selected_candidate_id=None,
                confidence=round(top_s * 0.6, 2),
                reason=(f"Indistinguishable near-tie between {sec_c.record_id} and "
                        f"{top_c.record_id} (equal amounts, overlapping entity terms, "
                        f"adjacent dates). Refusing to guess."),
                missing_evidence="No unique reference or distinguishing descriptor on the source record.",
                reasoner="deterministic")

    if top_s >= LLM_ACCEPT:
        return LLMResult(
            decision="match", selected_candidate_id=top_c.record_id,
            confidence=round(min(0.93, top_s), 2),
            reason="; ".join(top_why) + f"; date gap {abs((record.date - top_c.date).days)}d.",
            missing_evidence="" if record.ref_norm else "No payment reference present in source description.",
            reasoner="deterministic")

    return LLMResult(decision="no_match", selected_candidate_id=None,
                     confidence=round(top_s * 0.6, 2),
                     reason="Best candidate evidence is below the auto-match threshold.",
                     reasoner="deterministic")


# --------------------------------------------------------------------------
# Google Gemini Batch Reasoning Engine (1 Single Request for all Items)
# --------------------------------------------------------------------------

def _call_gemini_api(prompt: str, model: str, max_retries: int = 3) -> str:
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not set in environment or .env file")

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    req_body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.1
        }
    }
    body_bytes = json.dumps(req_body).encode("utf-8")

    for attempt in range(1, max_retries + 1):
        try:
            req = urllib.request.Request(
                url, data=body_bytes,
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
            return payload["candidates"][0]["content"]["parts"][0]["text"]
        except urllib.error.HTTPError as e:
            if e.code in (429, 503) and attempt < max_retries:
                time.sleep(attempt * 2.0)
                continue
            raise
        except Exception:
            if attempt < max_retries:
                time.sleep(1.5)
                continue
            raise


def batch_reason_over_candidates(
    work_items: list[tuple[Record, list[Record], list[Evidence]]],
    cfg
) -> dict[str, LLMResult]:
    """Evaluates all ambiguous candidate sets in a single unified Gemini call."""
    mode = resolve_mode(cfg)
    results: dict[str, LLMResult] = {}

    if mode != "gemini" or not work_items:
        for rec, cands, evs in work_items:
            results[rec.record_id] = _deterministic_reason(rec, cands, evs, cfg)
        return results

    model = os.environ.get("RECON_LLM_MODEL", "gemini-2.5-flash").strip()
    print(f"  [gemini-agent] Bundling {len(work_items)} ambiguous record(s) into single Gemini API request...", flush=True)

    tasks_payload = []
    for rec, cands, _ in work_items:
        tasks_payload.append({
            "target_record_id": rec.record_id,
            "source": rec.source,
            "amount": rec.amount,
            "date": str(rec.date),
            "reference": rec.reference or None,
            "description": rec.description,
            "candidate_pool": [{
                "candidate_id": c.record_id,
                "source": c.source,
                "amount": c.amount,
                "date": str(c.date),
                "reference": c.reference or None,
                "description": c.description,
                "counterparty": c.counterparty or None
            } for c in cands[:5]]
        })

    prompt_data = {
        "instructions": (
            "You are an expert AI Finance Controller. Evaluate each target record against its candidate pool.\n"
            "Apply financial reconciliation domain principles:\n"
            "1. Bank lines may be net of card/processor fees (e.g. 2.9% + $0.30, 2.5%, etc.).\n"
            "2. Settlement dates can lag transaction dates by up to 5 days.\n"
            "3. If candidate is clearly identified with high confidence (>= 0.80), decide 'match'.\n"
            "4. If candidates are indistinguishable (e.g. twin invoices with identical amounts), decide 'escalate'.\n"
            "5. If evidence is weak or missing, decide 'no_match'.\n"
        ),
        "tasks": tasks_payload,
        "required_output_schema": {
            "decisions": [
                {
                    "record_id": "string",
                    "decision": "match | no_match | escalate",
                    "selected_candidate_id": "candidate_id or null",
                    "confidence": "float between 0.0 and 1.0",
                    "reason": "explanation of fee netting, dates, or terms",
                    "missing_evidence": "string"
                }
            ]
        }
    }

    full_prompt = (
        "You are an autonomous AI Finance Controller performing multi-source reconciliation.\n"
        "Return ONLY a JSON object containing the 'decisions' array for every requested record.\n\n"
        + json.dumps(prompt_data, indent=2, default=str)
    )

    try:
        raw_text = _call_gemini_api(full_prompt, model)
        cleaned = raw_text.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        m = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if m:
            data = json.loads(m.group(0))
            decisions_list = data.get("decisions", [])
            for item in decisions_list:
                rid = item.get("record_id")
                dec = str(item.get("decision", "no_match")).lower()
                if dec not in {"match", "no_match", "escalate"}:
                    dec = "no_match"
                conf = max(0.0, min(1.0, float(item.get("confidence", 0.0))))
                sel = item.get("selected_candidate_id")
                reason = str(item.get("reason", ""))
                missing = str(item.get("missing_evidence", ""))

                results[rid] = LLMResult(
                    decision=dec,
                    selected_candidate_id=sel,
                    confidence=conf,
                    reason=reason,
                    missing_evidence=missing,
                    reasoner=f"gemini:{model}"
                )
                print(f"  [gemini-agent] -> {rid}: {dec.upper()} (sel={sel}, conf={conf:.2f}) | {reason[:50]}...", flush=True)

        # For any items missed by LLM, fallback to deterministic
        for rec, cands, evs in work_items:
            if rec.record_id not in results:
                results[rec.record_id] = _deterministic_reason(rec, cands, evs, cfg)

        print(f"  [gemini-agent] Successfully processed batch of {len(work_items)} records in 1 Gemini API call!", flush=True)
        return results

    except Exception as e:
        print(f"  [gemini-agent] Batch API call failed: {e}. Falling back to deterministic reasoner.", flush=True)
        for rec, cands, evs in work_items:
            fb = _deterministic_reason(rec, cands, evs, cfg)
            fb.reasoner = "gemini_fallback:deterministic"
            results[rec.record_id] = fb
        return results
