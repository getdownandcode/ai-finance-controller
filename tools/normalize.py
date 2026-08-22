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
    """Pull candidate reference tokens: styled refs (INV-1042, PO-990) + bare digit runs."""
    if not text:
        return set()
    up = str(text).upper()
    toks = set(re.findall(r"[A-Z]{2,4}-?\d{2,6}", up))
    toks |= set(re.findall(r"\b\d{3,6}\b", up))
    return {t.replace("-", "") for t in toks}


def desc_text(rec: Record) -> str:
    """All free-text evidence on a record, used for similarity scoring."""
    return f"{rec.description} {rec.counterparty} {rec.account}".strip()


def amount_tolerance(amount: float) -> float:
    """± max(2% of amount, $1.00) — the fuzzy amount tolerance."""
    return max(0.02 * abs(amount), 1.0)


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
        "balance", "payment_amount", "settlement_amount", "debit", "credit"
    ],
    "currency": [
        "currency", "curr", "ccy", "currency_code"
    ],
    "reference": [
        "reference", "ref", "ref_num", "ref_no", "invoice_no", "inv_num",
        "check_no", "cheque_no", "external_ref", "memo_ref", "reference_number"
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
    is_neg = False
    if s.startswith("(") and s.endswith(")"):
        is_neg = True
        s = s[1:-1].strip()
    s = re.sub(r"[^\d.\-+]", "", s)
    try:
        amt = float(s)
        return -abs(amt) if is_neg else amt
    except ValueError:
        return 0.0


def clean_date(val: Any) -> date:
    if isinstance(val, (date, datetime)):
        return val.date() if isinstance(val, datetime) else val
    ts = pd.to_datetime(val, errors="coerce")
    if pd.isna(ts):
        return date.today()
    return ts.date()


def parse_records_from_dataframe(df: pd.DataFrame, source: str) -> list[Record]:
    """Dynamically parses a DataFrame into standard Record objects with schema inference."""
    id_col = _find_column(df, "record_id")
    date_col = _find_column(df, "date")
    amount_col = _find_column(df, "amount")
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
        amt_val = clean_amount(row[amount_col]) if amount_col and pd.notna(row.get(amount_col)) else 0.0
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
