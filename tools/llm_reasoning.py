"""Autonomous LLM / AI Reasoning Tier (Tier 3).

Specialized in:
- Indian payment gateway fee netting (Razorpay Standard 2.0% MDR + 18% GST = 2.36%).
- Indian TDS deductions (Sec 194C 2%, Sec 194J 10%, Sec 194-O 1%).
- Razorpay Payout IMPS/NEFT fee structures.
- Multi-token Indian merchant / entity aliases (UPI handles, Smart Collect VAN).
- Stale/Duplicate UTR & Indistinguishable Twin Collision Guard.
"""
from __future__ import annotations

import json
import logging
import os
import re
import time
import urllib.error
import urllib.request
from typing import NamedTuple

from tools.candidate_retrieval import Evidence
from tools.fuzzy_match import text_similarity
from tools.normalize import Record

log = logging.getLogger(__name__)

LLM_ACCEPT = 0.75

# Indian Payment Gateway Fee Structures (MDR % + Fixed ₹)
COMMON_FEE_RATES = [
    (0.0236, 0.00),  # Razorpay standard gateway MDR (2.0% + 18% GST = 2.36%)
    (0.0200, 0.00),  # Standard 2.0% MDR / TDS 194C
    (0.0100, 0.00),  # TDS 194-O (1.0% E-Commerce)
    (0.0118, 0.00),  # 1.0% + 18% GST (1.18%)
    (0.1000, 0.00),  # TDS 194J (10.0% Professional Fees)
    (0.0290, 0.30),  # Stripe / International standard
    (0.0000, 5.90),  # Razorpay Payout IMPS Fee (₹5 + 18% GST = ₹5.90)
    (0.0000, 11.80), # Razorpay Payout NEFT/RTGS Fee (₹10 + 18% GST = ₹11.80)
]

FX_COMMON_RATES = {
    ("EUR", "USD"): 1.08,
    ("USD", "EUR"): 0.926,
    ("GBP", "USD"): 1.27,
    ("USD", "GBP"): 0.787,
    ("USD", "INR"): 86.50,
    ("INR", "USD"): 0.01156,
}

# Indian Merchant & Platform Aliases
KNOWN_MERCHANT_ALIASES = {
    "TCS": "Tata Consultancy Services Ltd",
    "INFOSYS": "Infosys Technologies Ltd",
    "JIO": "Reliance Jio Infocomm",
    "ZOMATO": "Zomato Media Pvt Ltd",
    "SWIGGY": "Swiggy Bundl Technologies",
    "FLIPKART": "Flipkart Internet Pvt Ltd",
    "RAZORPAY": "Razorpay Software Pvt Ltd",
    "RZP": "Razorpay Software Pvt Ltd",
    "AIRTEL": "Airtel Telecommunications",
    "BLUEDART": "Blue Dart Express",
    "ZEPTO": "Zepto Quick Commerce"
}


class LLMResult(NamedTuple):
    decision: str  # match | no_match | escalate | error
    selected_candidate_id: str | None
    confidence: float
    reason: str
    missing_evidence: str = ""
    reasoner: str = "llm"


def resolve_mode(cfg) -> str:
    flag = getattr(cfg, "llm_mode", "auto")
    if flag in ("deterministic", "simulated"):
        return "deterministic"
    if flag in ("gemini", "live"):
        return "gemini"
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    return "gemini" if api_key else "deterministic"


# --------------------------------------------------------------------------
# Deterministic AI Reasoner Fallback
# --------------------------------------------------------------------------

def _normalize_tokens(text: str) -> set[str]:
    clean = re.sub(r"[^a-zA-Z0-9\s]", " ", text).upper()
    tokens = set(clean.split())
    # Expand aliases
    expanded = set(tokens)
    for tok in tokens:
        if tok in KNOWN_MERCHANT_ALIASES:
            for word in KNOWN_MERCHANT_ALIASES[tok].upper().split():
                expanded.add(word)
    return {t for t in expanded if len(t) > 2 and t not in {"THE", "INC", "LTD", "CORP", "PVT", "LLC", "PAYMENT", "SETTLEMENT", "TRANSFER", "INVOICE"}}


def _deterministic_reason(
    record: Record,
    candidates: list[Record],
    evidences: list[Evidence],
    cfg
) -> LLMResult:
    """Deterministic reasoning engine executing financial rules and disambiguation."""
    def desc_text(r: Record) -> str:
        return f"{r.description} {r.counterparty or ''} {r.reference or ''}"

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
        if abs(rec_amt - cand_amt) <= 0.05:
            s += 0.55
            why.append("Exact nominal amount match")
        elif ev.amount_within_tol:
            s += 0.35
            why.append(f"Amount within tolerance (diff: ₹{ev.amount_diff:.2f})")
        else:
            # 2. Dynamic Fee Check: Gross * (1 - rate) - fixed = Net
            matched_fee = False
            for rate, fixed in COMMON_FEE_RATES:
                expected_net = cand_amt * (1 - rate) - fixed
                if abs(rec_amt - expected_net) <= max(1.0, cand_amt * 0.005):
                    s += 0.60
                    why.append(f"Matches gross amount (₹{cand_amt:.2f}) net of Razorpay/TDS {rate*100:.2f}% fee")
                    matched_fee = True
                    break

            # 3. Dynamic FX Check
            if not matched_fee and record.currency != cand.currency:
                fx_key = (record.currency, cand.currency)
                if fx_key in FX_COMMON_RATES:
                    expected_fx = cand_amt * FX_COMMON_RATES[fx_key]
                    if abs(rec_amt - expected_fx) / max(rec_amt, 1.0) <= 0.03:
                        s += 0.55
                        why.append(f"Matches cross-currency {record.currency}/{cand.currency} at ~{FX_COMMON_RATES[fx_key]:.2f}")

        # 4. Entity & Merchant Token Overlap
        cand_tokens = _normalize_tokens(desc_text(cand))
        overlap = rec_tokens & cand_tokens
        if overlap:
            s += min(0.35, 0.15 * len(overlap))
            why.append(f"Merchant/Counterparty match on: {', '.join(sorted(overlap)[:3])}")
        elif ev.desc_similarity >= 0.45:
            s += 0.20
            why.append(f"Narrative similarity {int(ev.desc_similarity * 100)}%")

        # 5. Settlement Window
        if ev.date_diff_days <= 3:
            s += 0.15
            why.append("Immediate settlement (<3d)")
        elif ev.date_diff_days <= 10:
            s += 0.10
            why.append(f"Settled in {ev.date_diff_days}d")
        elif ev.date_diff_days <= 30:
            s += 0.05
            why.append("Settled within standard 30d terms")

        # 6. Reference token overlap
        if ev.ref_equal or ev.ref_overlap:
            s += 0.30
            why.append("Reference identifier correlation")

        # 7. Invoice Status (Paid settlements prioritized over open unbilled items)
        c_status = str(getattr(cand, "status", "")).lower()
        if "paid" in c_status:
            s += 0.20
            why.append("Invoice status is confirmed paid")
        elif "open" in c_status:
            s -= 0.15
            why.append("Invoice status is open/unbilled")

        scored.append((round(s, 3), cand, why))

    scored.sort(key=lambda t: -t[0])
    top_s, top_c, top_why = scored[0]

    # Check for Twin Collisions / Runner-up Disambiguation
    if len(scored) > 1:
        sec_s, sec_c, _ = scored[1]
        amt_diff = abs(abs(top_c.amount) - abs(sec_c.amount))
        score_diff = top_s - sec_s

        # Twin collision occurs between rival candidates of the same source (e.g. two invoices with identical amount)
        if top_c.source == sec_c.source and amt_diff <= 0.05 and score_diff <= 0.08:
            has_unique_ref = bool(
                record.ref_norm and
                (record.ref_norm == top_c.ref_norm or record.ref_norm == sec_c.ref_norm) and
                top_c.ref_norm != sec_c.ref_norm
            )
            if not has_unique_ref:
                return LLMResult(
                    decision="escalate",
                    selected_candidate_id=None,
                    confidence=0.50,
                    reason=f"AMBIGUOUS_TWIN_COLLISION: cannot disambiguate between twin candidates {top_c.record_id} and {sec_c.record_id} (identical amount ₹{abs(top_c.amount):.2f})",
                    missing_evidence=f"Unique reference or settlement ID to distinguish {top_c.record_id} vs {sec_c.record_id}",
                    reasoner="deterministic"
                )

        # Disambiguate if date difference is significant (>3d)
        top_d = abs((record.date - top_c.date).days)
        sec_d = abs((record.date - sec_c.date).days)
        if abs(top_d - sec_d) >= 3 and top_d < sec_d:
            top_s += 0.12
            top_why.append(f"Tie-breaker: closer settlement date ({top_d}d vs {sec_d}d)")

    if top_s >= LLM_ACCEPT:
        return LLMResult(
            decision="match",
            selected_candidate_id=top_c.record_id,
            confidence=round(min(0.96, top_s), 2),
            reason="; ".join(top_why),
            missing_evidence="",
            reasoner="deterministic"
        )

    return LLMResult(
        decision="no_match",
        selected_candidate_id=top_c.record_id if top_s >= 0.40 else None,
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
        "generationConfig": {"temperature": 0.1, "maxOutputTokens": 4096}
    }

    data = json.dumps(req_body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})

    for attempt in range(1, max_retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=12) as response:
                result = json.loads(response.read().decode("utf-8"))
                candidates = result.get("candidates", [])
                if not candidates:
                    raise ValueError("No candidates returned from Gemini API")
                parts = candidates[0].get("content", {}).get("parts", [])
                if not parts:
                    raise ValueError("No text parts returned from Gemini API")
                return parts[0].get("text", "")
        except urllib.error.HTTPError as e:
            if e.code in (429, 503) and attempt < max_retries:
                time.sleep(attempt * 1.5)
                continue
            raise
        except Exception:
            if attempt < max_retries:
                time.sleep(1.0)
                continue
            raise


def batch_reason_over_candidates(
    work_items: list[tuple[Record, list[Record], list[Evidence]]],
    cfg
) -> dict[str, LLMResult]:
    """Evaluates all ambiguous candidate sets using Google Gemini AI with deterministic fallback."""
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
                "currency": rec.currency,
                "date": str(rec.date),
                "reference": rec.reference or None,
                "description": rec.description,
                "counterparty": rec.counterparty or None
            },
            "candidate_pool": [{
                "candidate_id": c.record_id,
                "source": c.source,
                "amount": c.amount,
                "currency": c.currency,
                "date": str(c.date),
                "reference": c.reference or None,
                "description": c.description,
                "counterparty": c.counterparty or None
            } for c in cands[:8]]
        })

    system_instructions = (
        "You are an expert AI Finance Controller performing multi-source ledger & bank reconciliation in the Indian fintech & banking ecosystem (Razorpay, UPI, NEFT, RTGS, IMPS, TDS, GSTIN).\n"
        "Analyze each target transaction against its candidate pool and decide whether a valid economic match exists.\n\n"
        "Core Financial Matching Principles:\n"
        "1. Directionality & Sign Inversion: Bank debits (outflows, -₹X) match Ledger credits (+₹X) and Invoice bills (₹X).\n"
        "2. Indian Payment Gateway & TDS Netting:\n"
        "   - Razorpay Standard MDR: 2.0% + 18% GST = 2.36% deduction on payouts.\n"
        "   - TDS Sec 194C (2%) / Sec 194J (10%) / Sec 194-O (1% e-commerce) deductions.\n"
        "   - Razorpay Payout IMPS/NEFT fees: ₹5.90 / ₹11.80.\n"
        "3. Semantic Merchant & UPI Resolution: Normalize Indian vendor aliases and handles (e.g. 'UPI/SWIGGY' = Swiggy Bundl, 'TCS' = Tata Consultancy, 'RZP PAYOUT' = Razorpay Settlement).\n"
        "4. Settlement Lag: Bank settlements lag invoice/ledger dates by 1 to 30 days.\n"
        "5. Indistinguishable Twin Collision Guard: If two candidates share identical amounts, identical counterparties, and identical/near-identical dates, and the target line has no unique invoice reference to distinguish them (e.g. twin invoices), do NOT pick one arbitrarily or force-match. Return 'escalate' with reason 'AMBIGUOUS_TWIN_COLLISION: cannot disambiguate between twin candidates [ID1] and [ID2]'.\n\n"
        "Decision Rules:\n"
        "- 'match': High confidence (>= 0.75) that target and candidate represent the same economic transaction.\n"
        "- 'escalate': Indistinguishable twin collision or duplicate that genuinely requires human manual check.\n"
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
                    "reason": "precise financial explanation (Razorpay MDR calculation, TDS deduction, date settlement, merchant resolution, or twin collision)",
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
                cand_id = item.get("selected_candidate_id")
                try:
                    conf = float(item.get("confidence", 0.0))
                except (ValueError, TypeError):
                    conf = 0.0
                reason = str(item.get("reason", "Gemini AI decision"))
                missing = str(item.get("missing_evidence", ""))
                results[rid] = LLMResult(
                    decision=dec,
                    selected_candidate_id=cand_id if dec == "match" else None,
                    confidence=conf,
                    reason=reason,
                    missing_evidence=missing,
                    reasoner="gemini"
                )

        # Check for any missing items and fill via deterministic fallback
        for rec, cands, evs in work_items:
            if rec.record_id not in results:
                results[rec.record_id] = _deterministic_reason(rec, cands, evs, cfg)

        return results

    except Exception as e:
        log.warning("Gemini AI API call failed (%s). Engaging deterministic fallback reasoner.", e)
        for rec, cands, evs in work_items:
            results[rec.record_id] = _deterministic_reason(rec, cands, evs, cfg)
        return results
