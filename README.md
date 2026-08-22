# AI Finance Controller — Production Agentic Reconciliation System

An autonomous AI Finance Controller Agent that closes a complete finance-ops reconciliation loop across multi-source financial feeds (**Bank Feed**, **Internal General Ledger**, and **Invoices**).

The system includes both an **Interactive React Web UI** and a **CLI Tool**, powered by **Google Gemini API LLM Reasoning**, **Deterministic Exact Matching**, and **Multi-Signal Fuzzy Matching**.

---

## Key Features

1. **Modern Light-Theme React Web UI**:
   - **Executive Dashboard**: Live KPI cards, Reconciled Cash Exposure Snapshot, Resolution Tier Breakdown.
   - **Data Ingestion Hub**: Drag-and-drop CSV upload for custom files + 1-Click Synthetic Benchmark Demo loader.
   - **Exceptions Triage Table**: Searchable & filterable table with reason codes (`POSSIBLE_DUPLICATE`, `DUPLICATE_CANDIDATE`, `LOW_CONFIDENCE`, etc.), confidence meters, and recommended human actions.
   - **Reconciled Groups Inspector**: Visual clusters across Bank, Ledger, and Invoices.
   - **Agent Audit Trail**: Chronological event log with step-by-step reasoning details.
   - **Export Center**: 1-click download of `.md`, `.csv`, and `.json` audit reports.
2. **Schema-Aware CSV Normalization**:
   - Automatically maps non-standard column headers (e.g. `Tx_Amount`, `Total`, `Memo`, `Description`, `Ref_No`, `Invoice_Number`).
   - Cleans formatting, currencies, symbols, negative amounts `($100)`, and date strings.
3. **Multi-Tiered Decision Engine**:
   - **Tier 1 (Exact Matcher)**: Deterministic matching for clean transactions (confidence `1.00`).
   - **Tier 2 (Fuzzy Matcher)**: Multi-signal scoring for payment fees, date settlement lags, and description token overlap ($\ge 0.90$).
   - **Tier 3 (Google Gemini LLM Reasoner)**: Agentic reasoning over complex ambiguous candidate sets, fee deductions (e.g. 2.9% + \$0.30), vendor aliases, and twin near-ties ($\ge 0.80$).
4. **Zero Silent Drops Guarantee**:
   - Every single record is accounted for. Unresolved records are triaged as explicit exceptions.
5. **Reconciled Cash Position Snapshot**:
   - Calculates Confirmed Bank Cash, Confirmed Ledger Cash, Reconciled Variance, and Unresolved Exception Exposure.

---

## 🚀 How to Launch the Web UI

### Step 1: Start the Backend & Web App Server

```bash
cd "/Users/amarkp/Documents/AI Finance Controller"
source .venv/bin/activate
python server.py
```

### Step 2: Open in Your Browser

Navigate to **[http://127.0.0.1:8000](http://127.0.0.1:8000)** in your browser!

---

## 💻 Optional: Running in Terminal CLI

```bash
# Reconcile any custom user CSV files
python run_agent.py \
  --bank-csv "/path/to/my_bank_statement.csv" \
  --ledger-csv "/path/to/my_quickbooks_ledger.csv" \
  --invoices-csv "/path/to/my_invoices.csv" \
  --reports-dir "reports"

# Run 80-record synthetic benchmark
python run_agent.py

# Force offline deterministic mode
python run_agent.py --llm off
```

---

## 📁 Generated Reports (`reports/`)

- **`reports/recon_report.md`**: Executive markdown report with match rate, method breakdown, cash position, and exceptions.
- **`reports/exceptions.csv`**: Structured exception list ready for accounting review in Excel / Sheets.
- **`reports/recon_report.json`**: Machine-readable JSON summary for downstream ERP integration.
- **`reports/audit_log.json`**: Comprehensive step-by-step audit log of every decision made by the agent.
