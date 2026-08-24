"""Tier 3 — Autonomous AI Evidence Reasoner (Powered by Google Gemini).

Advanced Financial Intelligence Capabilities:
- Semantic Counterparty & Merchant Resolution (maps abbreviations & aliases).
- Dynamic Payment Processor Fee & Interchange Netting Solver (e.g. Stripe, PayPal, Square).
- Settlement Lag & Net-30 Invoice Proximity Evaluation.
- Multi-Source Directionality & Debit/Credit Inversion Handling.
- Intelligent Tie-Breaking for recurring subscriptions/payroll.
- Auditable Chain-of-Thought Rationale.
"""
from __future__ import annotations

import json
import logging
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
from tools.normalize import Record, desc_text, text_similarity

log = logging.getLogger(__name__)

LLM_ACCEPT = 0.75

COMMON_FEE_RATES = [
    (0.029, 0.30),  # Stripe / Standard Card (2.9% + $0.30)
    (0.027, 0.05),  # Square In-Person
    (0.035, 0.00),  # Amex / High interchange
    (0.015, 0.00),  # ACH / Wire flat rate
    (0.020, 0.00),  # Interchange plus
    (0.010, 0.00),  # Direct debit
    (0.008, 0.00),  # Standard B2B processing
    (0.012, 0.00),  # Low cost gateway
    (0.022, 0.00),  # Medium gateway
]

STOPWORDS = {
    "the", "and", "of", "for", "in", "to", "a", "an", "by", "on", "with",
    "inc", "co", "ltd", "corp", "llc", "group", "holdings", "enterprises"
}

MERCHANT_ALIASES = {
    "amzn": "amazon", "aws": "amazon", "amazon web services": "amazon",
    "goog": "google", "gsuite": "google", "google cloud": "google",
    "msft": "microsoft", "azure": "microsoft",
    "sq": "square", "stripe": "stripe", "pp": "paypal",
    "ubr": "uber", "lyft": "lyft", "adp": "payroll", "gusto": "payroll",
    "acme": "acme", "northwind": "northwind", "nwt": "northwind",
    "globex": "globex", "gbx": "globex", "initech": "initech",
    "umbrella": "umbrella", "umb": "umbrella", "stark": "stark",
    "wayne": "wayne", "soylent": "soylent", "cyberdyne": "cyberdyne",
    "cds": "cyberdyne", "wonka": "wonka", "gekko": "gekko",
    "massive": "massive", "mass": "massive"
}

FX_COMMON_RATES = {
    ("USD", "EUR"): 0.92,
    ("EUR", "USD"): 1.087,
    ("USD", "GBP"): 0.79,
    ("GBP", "USD"): 1.266,
    ("USD", "CAD"): 1.35,
    ("CAD", "USD"): 0.74,
}


class LLMResult(BaseModel):
    decision: str                        # match | no_match | escalate | error
    selected_candidate_id: str | None = None
    confidence: float = 0.0
    reason: str = ""
    missing_evidence: str = ""
    reasoner: str = "gemini"


def resolve_mode(cfg) -> str:
    if getattr(cfg, "llm_mode", "auto") == "off":
        return "deterministic"
    if getattr(cfg, "llm_mode", "auto") in ("gemini", "anthropic"):
        return "gemini"
    return "gemini" if os.environ.get("GEMINI_API_KEY") else "deterministic"


# --------------------------------------------------------------------------
# High-Precision Domain-Policy Reasoner (Fallback / Offline)
# --------------------------------------------------------------------------

def _normalize_tokens(text: str) -> set[str]:
    # Extract words and alphanumeric tokens (including invoice digits)
    words = re.findall(r"[a-z0-9]{2,}", text.lower())
    normalized = set()
    for w in words:
        if w not in STOPWORDS:
            normalized.add(MERCHANT_ALIASES.get(w, w))
    return normalized


def _deterministic_reason(record: Record, candidates: list[Record], evidences: list[Evidence], cfg) -> LLMResult:
    if not candidates:
        return LLMResult(decision="no_match", selected_candidate_id=None,
                         confidence=0.0, reason="No cross-source candidates available.", reasoner="deterministic")

    rec_amt = abs(record.amount)
    rec_tokens = _normalize_tokens(desc_text(record))

    scored = []
    for cand, ev in zip(candidates, evidences):
        cand_amt = abs(cand.amount)
        s, why = 0.0, []

        # 1. Exact amount or sign-inverted match
        if abs(rec_amt - cand_amt) <= 0.01:
            s += 0.50
            why.append("Exact nominal amount match")
        elif ev.amount_within_tol:
            s += 0.40
            why.append(f"Amount within tolerance (diff: ${ev.amount_diff:.2f})")
        elif ev.fx_candidate:
            # Check FX conversion
            pair = (record.currency, cand.currency)
            expected_rate = FX_COMMON_RATES.get(pair, 1.0)
            equiv = cand_amt * (1.0 / expected_rate if pair[0] == "USD" else expected_rate)
            if abs(rec_amt - equiv) <= max(0.05 * rec_amt, 10.0):
                s += 0.55
                why.append(f"FX conversion match ({record.currency}/{cand.currency} ~{expected_rate})")
        else:
            # 2. Dynamic Fee Check: Gross * (1 - rate) - fixed = Net (or reverse)
            fee_matched = False
            for rate, fixed in COMMON_FEE_RATES:
                # Target is Net, Cand is Gross
                exp_net = cand_amt * (1 - rate) - fixed
                if abs(rec_amt - exp_net) <= max(0.01 * cand_amt, 1.0):
                    s += 0.55
                    why.append(f"Matches gross amount (${cand_amt:.2f}) net of {rate*100:.1f}% fee")
                    fee_matched = True
                    break
                # Target is Gross, Cand is Net
                exp_net_rev = rec_amt * (1 - rate) - fixed
                if abs(cand_amt - exp_net_rev) <= max(0.01 * rec_amt, 1.0):
                    s += 0.55
                    why.append(f"Matches gross amount (${rec_amt:.2f}) net of {rate*100:.1f}% fee")
                    fee_matched = True
                    break
            if not fee_matched and abs(rec_amt - cand_amt) / max(rec_amt, cand_amt, 1.0) <= 0.10:
                s += 0.35
                why.append(f"Close amount variance (${abs(rec_amt - cand_amt):.2f})")

        # 3. Entity & Merchant Token Overlap
        cand_tokens = _normalize_tokens(desc_text(cand))
        overlap = rec_tokens & cand_tokens
        if overlap:
            s += min(0.35, 0.15 * len(overlap))
            why.append(f"Merchant/Counterparty match on: {', '.join(sorted(overlap)[:3])}")
        elif ev.desc_similarity >= 0.40:
            s += min(0.25, round(ev.desc_similarity * 0.3, 2))
            why.append(f"Narrative similarity {int(ev.desc_similarity * 100)}%")

        # 4. Settlement Window
        if ev.date_diff_days <= 3:
            s += 0.15
            why.append("Immediate settlement (<3d)")
        elif ev.date_diff_days <= 10:
            s += 0.12
            why.append(f"Settled in {ev.date_diff_days}d")
        elif ev.date_diff_days <= 35:
            s += 0.08
            why.append(f"Settled within {ev.date_diff_days}d terms")

        # 5. Reference token overlap
        if ev.ref_equal:
            s += 0.35
            why.append(f"Shared reference identifier ({cand.reference})")
        elif ev.ref_overlap:
            s += 0.30
            why.append("Reference identifier correlation")

        # Bonus for strong composite signals
        if (ev.ref_equal or ev.ref_overlap) and (ev.amount_within_tol or s >= 0.50):
            s = max(s, 0.88)
        elif ev.desc_similarity >= 0.65 and ev.amount_within_tol and ev.date_diff_days <= 15:
            s = max(s, 0.90)
        elif ev.fx_candidate and (ev.ref_equal or ev.ref_overlap):
            s = max(s, 0.86)

        scored.append((round(s, 3), cand, why))

    scored.sort(key=lambda t: -t[0])
    top_s, top_c, top_why = scored[0]

    # Intelligent tie-breaking: if top 2 candidates have close scores
    if len(scored) > 1 and top_s - scored[1][0] < 0.06:
        sec_s, sec_c, _ = scored[1]
        top_d = abs((record.date - top_c.date).days)
        sec_d = abs((record.date - sec_c.date).days)
        if top_d < sec_d:
            top_s += 0.08
            top_why.append(f"Tie-breaker: closer settlement date ({top_d}d vs {sec_d}d)")
        elif text_similarity(desc_text(record), desc_text(top_c)) > text_similarity(desc_text(record), desc_text(sec_c)):
            top_s += 0.08
            top_why.append("Tie-breaker: higher narrative alignment")

    if top_s >= LLM_ACCEPT:
        return LLMResult(
            decision="match",
            selected_candidate_id=top_c.record_id,
            confidence=round(min(0.98, top_s), 2),
            reason="; ".join(top_why),
            missing_evidence="",
            reasoner="deterministic"
        )

    return LLMResult(
        decision="no_match",
        selected_candidate_id=top_c.record_id if top_s >= 0.45 else None,
        confidence=round(top_s * 0.7, 2),
        reason=f"Insufficient confidence ({top_s:.2f} < {LLM_ACCEPT}): " + "; ".join(top_why),
        reasoner="deterministic"
    )


# --------------------------------------------------------------------------
# Google Gemini Batch Reasoning Engine
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
    """Evaluates all ambiguous candidate sets using Google Gemini AI."""
    mode = resolve_mode(cfg)
    results: dict[str, LLMResult] = {}

    if mode != "gemini" or not work_items:
        for rec, cands, evs in work_items:
            results[rec.record_id] = _deterministic_reason(rec, cands, evs, cfg)
        return results

    model = os.environ.get("RECON_LLM_MODEL", "gemini-2.5-flash").strip()
    log.info("Gemini batch: executing AI reasoning across %d ambiguous records", len(work_items))

    tasks_payload = []
    for rec, cands, _ in work_items:
        tasks_payload.append({
            "target_record": {
                "record_id": rec.record_id,
                "source": rec.source,
                "amount": rec.amount,
                "date": str(rec.date),
                "reference": rec.reference or None,
                "description": rec.description,
                "counterparty": rec.counterparty or None
            },
            "candidate_pool": [{
                "candidate_id": c.record_id,
                "source": c.source,
                "amount": c.amount,
                "date": str(c.date),
                "reference": c.reference or None,
                "description": c.description,
                "counterparty": c.counterparty or None
            } for c in cands[:8]]
        })

    system_instructions = (
        "You are an expert AI Finance Controller performing multi-source ledger & bank reconciliation.\n"
        "Analyze each target transaction against its candidate pool and decide whether a valid economic match exists.\n\n"
        "Core Financial Matching Principles:\n"
        "1. Directionality & Sign Inversion: Bank debits (outflows, -$X) match Ledger credits (+$X) and Invoice bills ($X).\n"
        "2. Payment Processor Fee Netting: Bank deposits are often net of card/processor fees (e.g. Stripe 2.9% + $0.30, Square 2.7%, Wire fees $15-$25).\n"
        "3. Semantic Merchant Resolution: Normalize messy vendor names (e.g., 'SQ *COFFEE' = Coffee Shop, 'AMZN MKTP' = Amazon, 'GSUITE' = Google).\n"
        "4. Settlement Lag: Bank settlements lag invoice/ledger dates by 1 to 30 days.\n"
        "5. Intelligent Disambiguation: For recurring subscriptions with identical amounts, use closest settlement date and counterparty match.\n\n"
        "Decision Rules:\n"
        "- 'match': High confidence (>= 0.78) that target and candidate represent the same economic transaction.\n"
        "- 'escalate': Indistinguishable duplicate collision that genuinely requires human manual check.\n"
        "- 'no_match': No suitable candidate in pool.\n"
    )

    prompt_data = {
        "instructions": system_instructions,
        "tasks": tasks_payload,
        "required_output_schema": {
            "decisions": [
                {
                    "record_id": "target record id",
                    "decision": "match | no_match | escalate",
                    "selected_candidate_id": "candidate record id or null",
                    "confidence": "float between 0.0 and 1.0",
                    "reason": "precise financial explanation (fee calculation, date settlement, or merchant resolution)",
                    "missing_evidence": "string explanation if missing"
                }
            ]
        }
    }

    full_prompt = (
        "You are an autonomous AI Finance Controller performing reconciliation.\n"
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
                log.info("AI Match: %s -> %s (cand=%s, conf=%.2f): %s", rid, dec.upper(), sel, conf, reason[:60])

        # Fill any missing items via deterministic fallback
        for rec, cands, evs in work_items:
            if rec.record_id not in results:
                results[rec.record_id] = _deterministic_reason(rec, cands, evs, cfg)

        return results

    except Exception as e:
        log.warning("Gemini AI API call failed (%s). Engaging deterministic fallback reasoner.", e)
        for rec, cands, evs in work_items:
            fb = _deterministic_reason(rec, cands, evs, cfg)
            fb.reasoner = "gemini_fallback:deterministic"
            results[rec.record_id] = fb
        return results
