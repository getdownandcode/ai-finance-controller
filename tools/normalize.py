"""Shared schemas + normalization utilities.

Deterministic problems should be solved deterministically: everything in this
module is pure, side-effect-free preprocessing.
"""
from __future__ import annotations

import math
import re
from datetime import date, datetime
from typing import Any

import pandas as pd
from pydantic import BaseModel, Field, model_validator

try:  # prefer rapidfuzz, fall back to stdlib so the demo always runs
    from rapidfuzz import fuzz as _fuzz

    def text_similarity(a: str, b: str) -> float:
        if not a.strip() or not b.strip():
            return 0.0
        return _fuzz.token_set_ratio(a, b) / 100.0
except ImportError:  # pragma: no cover
    import difflib

    def text_similarity(a: str, b: str) -> float:
        if not a.strip() or not b.strip():
            return 0.0
        return difflib.SequenceMatcher(None, sorted(a.lower().split()),
                                       sorted(b.lower().split())).ratio()


class Record(BaseModel):
    """A normalized transaction from any source system."""
    record_id: str
    source: str                     # "bank" | "ledger" | "invoice"
    date: date
    amount: float
    currency: str = "USD"
    reference: str = ""
    description: str = ""
    counterparty: str = ""          # vendor / customer
    account: str = ""               # ledger account / GL code
    status: str = ""                # invoice status (paid/open)
    ref_norm: str = ""
    ref_tokens: list = Field(default_factory=list)

    @model_validator(mode="after")
    def _normalize(self):
        self.ref_norm = norm_text(self.reference)
        self.ref_tokens = sorted(extract_ref_tokens(f"{self.reference} {self.description} {self.counterparty}"))
        return self


class MatchDecision(BaseModel):
    """The outcome of one matching attempt between two records."""
    matched: bool
    method: str                     # "exact" | "fuzzy" | "llm"
    confidence: float
    reason: str
    signals: dict = Field(default_factory=dict)


class ExceptionItem(BaseModel):
    """An honest, auditable exception for one unresolved record."""
    record_id: str
    source: str
    reason: str
    best_candidate_id: str | None = None
    best_candidate_source: str | None = None
    confidence: float = 0.0
    explanation: str = ""
    recommended_action: str = "human_review"


def money(x: float) -> float:
    return round(x + 1e-9, 2)


def norm_text(s: str) -> str:
    """Lowercase, strip punctuation (keep '-' for refs), collapse whitespace."""
    if not s:
        return ""
    s = re.sub(r"[^a-z0-9\-]+", " ", str(s).lower())
    return re.sub(r"\s+", " ", s).strip()


def extract_ref_tokens(text: str) -> set[str]:
    """Pull candidate reference tokens: styled refs (INV-1042, PO-990, EXP-2001, CN-9000), comma-separated refs, and digit runs."""
    if not text:
        return set()
    up = str(text).upper()
    toks = set(re.findall(r"[A-Z]{2,6}-?\d{2,7}", up))
    toks |= set(re.findall(r"[A-Z]{2,6}\s+\d{2,7}", up))
    toks |= set(re.findall(r"\b\d{4,7}\b", up))
    # Support comma/semicolon/space separated lists like INV-5049,INV-5050
    for chunk in re.split(r"[,;/]+", up):
        sub_toks = re.findall(r"[A-Z]{2,6}-?\d{2,7}", chunk.strip())
        toks.update(sub_toks)
    clean = set()
    for t in toks:
        c = re.sub(r"[\s\-]+", "", t).strip()
        if c:
            clean.add(c)
    return clean


def desc_text(rec: Record) -> str:
    """All free-text evidence on a record, used for similarity scoring."""
    return f"{rec.description} {rec.counterparty} {rec.account} {rec.reference}".strip()


def amount_tolerance(amount: float) -> float:
    """Dynamic tolerance covering standard gateway fee rates (up to ~3.8% + $0.30 fixed fee or $2.00 min)."""
    amt = abs(amount)
    return max(0.038 * amt + 0.35, 2.0)


# --------------------------------------------------------------------------
# Dynamic CSV Column Resolution & Data Cleaning (Production Ingestion)
# --------------------------------------------------------------------------

COLUMN_ALIASES = {
    "record_id": [
        "record_id", "id", "bank_id", "ledger_id", "invoice_id",
        "transaction_id", "trans_id", "tx_id", "entry_id", "ref_id", "document_id"
    ],
    "date": [
        "date", "transaction_date", "trans_date", "tx_date", "invoice_date",
        "post_date", "booking_date", "value_date", "created_at", "timestamp"
    ],
    "amount": [
        "amount", "net_amount", "gross_amount", "total", "value", "amt",
        "balance", "payment_amount", "settlement_amount"
    ],
    "debit": [
        "debit", "debit_amount", "dr", "payment", "withdrawal", "outflow", "paid_out"
    ],
    "credit": [
        "credit", "credit_amount", "cr", "deposit", "inflow", "paid_in", "received"
    ],
    "currency": [
        "currency", "curr", "ccy", "currency_code"
    ],
    "reference": [
        "reference", "ref", "ref_num", "ref_no", "invoice_no", "inv_num",
        "check_no", "cheque_no", "external_ref", "memo_ref", "reference_number", "invoice_id"
    ],
    "description": [
        "description", "desc", "memo", "narrative", "details",
        "line_description", "particulars", "transaction_details", "text"
    ],
    "counterparty": [
        "counterparty", "vendor", "vendor_name", "customer", "customer_name",
        "payee", "payer", "party", "beneficiary", "merchant"
    ],
    "account": [
        "account", "account_name", "account_code", "gl_account",
        "nominal_code", "category", "ledger_account"
    ],
    "status": [
        "status", "invoice_status", "payment_status", "state"
    ]
}


def _find_column(df: pd.DataFrame, field_name: str) -> str | None:
    cols = {str(c).lower().strip().replace(" ", "_"): c for c in df.columns}
    aliases = COLUMN_ALIASES.get(field_name, [field_name])
    for alias in aliases:
        if alias in cols:
            return cols[alias]
    return None


def clean_amount(val: Any) -> float:
    if val is None or pd.isna(val):
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip()
    if not s:
        return 0.0
    is_neg = False
    if s.startswith("(") and s.endswith(")"):
        is_neg = True
        s = s[1:-1].strip()
    elif s.startswith("-"):
        is_neg = True
        s = s[1:].strip()
    elif s.endswith("-"):
        is_neg = True
        s = s[:-1].strip()
    elif s.endswith("CR") or s.endswith("cr"):
        s = s[:-2].strip()
    elif s.endswith("DR") or s.endswith("dr"):
        is_neg = True
        s = s[:-2].strip()

    # Strip currency codes and symbols
    s = re.sub(r"[A-Z]{3}|\$|€|£|¥|₹", "", s).strip()

    # Handle European format: 1.234,56 -> 1234.56
    if re.search(r"^\d{1,3}(\.\d{3})+,\d{2}$", s):
        s = s.replace(".", "").replace(",", ".")
    elif "," in s and "." in s and s.rfind(",") > s.rfind("."):
        # e.g. 1.234,56
        s = s.replace(".", "").replace(",", ".")
    else:
        # Standard US format: 1,234.56 -> 1234.56
        s = s.replace(",", "")

    s = re.sub(r"[^\d.\-+]", "", s)
    try:
        amt = float(s)
        return -abs(amt) if is_neg else amt
    except ValueError:
        return 0.0


def clean_date(val: Any) -> date:
    if isinstance(val, (date, datetime)):
        return val.date() if isinstance(val, datetime) else val
    s = str(val).strip()
    if not s or s.lower() in ("nan", "none", "nat"):
        return date.today()
    # Try direct isoformat first
    try:
        return date.fromisoformat(s[:10])
    except Exception:
        pass
    ts = pd.to_datetime(val, errors="coerce")
    if pd.isna(ts):
        import logging
        logging.getLogger(__name__).warning("Unparseable date %r — falling back to today", val)
        return date.today()
    return ts.date()


def parse_records_from_dataframe(df: pd.DataFrame, source: str) -> list[Record]:
    """Dynamically parses a DataFrame into standard Record objects with schema inference."""
    id_col = _find_column(df, "record_id")
    date_col = _find_column(df, "date")
    amount_col = _find_column(df, "amount")
    debit_col = _find_column(df, "debit")
    credit_col = _find_column(df, "credit")
    curr_col = _find_column(df, "currency")
    ref_col = _find_column(df, "reference")
    desc_col = _find_column(df, "description")
    counterparty_col = _find_column(df, "counterparty")
    account_col = _find_column(df, "account")
    status_col = _find_column(df, "status")

    records: list[Record] = []
    prefix = source[0].upper()
    for idx, row in enumerate(df.to_dict(orient="records")):
        rid = str(row[id_col]).strip() if id_col and pd.notna(row.get(id_col)) else f"{prefix}-{idx+1:03d}"
        d_val = clean_date(row[date_col]) if date_col and pd.notna(row.get(date_col)) else date.today()

        if amount_col and pd.notna(row.get(amount_col)) and str(row.get(amount_col)).strip() != "":
            amt_val = clean_amount(row[amount_col])
        elif debit_col or credit_col:
            d_amt = clean_amount(row.get(debit_col)) if debit_col and pd.notna(row.get(debit_col)) else 0.0
            c_amt = clean_amount(row.get(credit_col)) if credit_col and pd.notna(row.get(credit_col)) else 0.0
            if c_amt != 0.0:
                amt_val = abs(c_amt)
            elif d_amt != 0.0:
                amt_val = -abs(d_amt)
            else:
                amt_val = 0.0
        else:
            amt_val = 0.0

        curr_val = str(row[curr_col]).strip().upper() if curr_col and pd.notna(row.get(curr_col)) else "USD"
        ref_val = str(row[ref_col]).strip() if ref_col and pd.notna(row.get(ref_col)) else ""
        desc_val = str(row[desc_col]).strip() if desc_col and pd.notna(row.get(desc_col)) else ""
        counterparty_val = str(row[counterparty_col]).strip() if counterparty_col and pd.notna(row.get(counterparty_col)) else ""
        account_val = str(row[account_col]).strip() if account_col and pd.notna(row.get(account_col)) else ""
        status_val = str(row[status_col]).strip() if status_col and pd.notna(row.get(status_col)) else ""

        records.append(Record(
            record_id=rid,
            source=source,
            date=d_val,
            amount=money(amt_val),
            currency=curr_val,
            reference=ref_val,
            description=desc_val,
            counterparty=counterparty_val,
            account=account_val,
            status=status_val
        ))
    return records
