# MatchMind: Autonomous AI Finance Controller & Multi-Source Reconciliation Agent

> **Built for the Razorpay Buildathon Hackathon**  
> An autonomous financial controller that ingests **Bank Feeds**, **ERP/General Ledgers**, and **Invoices/Credit Notes**, performs 3-way multi-tier reconciliation, resolves Indian payment gateway fees (Razorpay MDR & TDS), guards against duplicate collisions, and models 30/60/90-day forward cash runway.

---

## 🏛️ 1. System Architecture

MatchMind follows a **Tiered Agentic Architecture** governed by policy controls, where cheaper deterministic tools resolve high-confidence transactions first, reserving AI reasoning only for genuinely ambiguous financial events.

```
                  ┌────────────────────────────────────────────────────────┐
                  │                 MULTI-SOURCE RAW INGESTION             │
                  │  • Bank Feeds (HDFC, ICICI, SBI, Axis, Razorpay X)     │
                  │  • General Ledger (TallyPrime, Zoho Books, SAP, ERP)   │
                  │  • Invoices & Credit Notes (GST Invoices, B2B Bills)   │
                  └───────────────────────────┬────────────────────────────┘
                                              │
                                              ▼
                  ┌────────────────────────────────────────────────────────┐
                  │               TOOLS / NORMALIZE PIPELINE               │
                  │  • INR (₹) Lakhs/Crores & Multi-Currency Normalization │
                  │  • Column Alias Mapping (UTR, RRN, GSTIN, VAN)         │
                  │  • Sign-Inversion Matrix & Token Extraction            │
                  └───────────────────────────┬────────────────────────────┘
                                              │
                                              ▼
                  ┌────────────────────────────────────────────────────────┐
                  │           AUTONOMOUS CONTROLLER & MATCHING AGENT       │
                  ├────────────────────────────────────────────────────────┤
                  │ [Pass 0]  Phantom Net-Zero UPI & Auto-Reversal Filter  │
                  │ [Tier 1]  Deterministic Exact & Paisa Round-off Match │
                  │ [Tier 1.5] Credit Notes, Debit Notes & Multi-Part Match│
                  │ [Tier 2]  Multi-Signal Fuzzy Match (30d terms window)  │
                  │ [Tier 3]  AI Evidence Reasoner (Razorpay MDR, TDS, RZP)│
                  └───────────────────────────┬────────────────────────────┘
                                              │
                         ┌────────────────────┴────────────────────┐
                         ▼                                         ▼
            ┌─────────────────────────┐               ┌─────────────────────────┐
            │   RECONCILED CLUSTERS   │               │     EXCEPTION QUEUE     │
            │ • 3-Way Verified Groups │               │ • Duplicate Collisions  │
            │ • Confidence Scores     │               │ • Unidentified Wires    │
            │ • Full Audit Evidence   │               │ • Twin Invoices (Triage)│
            └────────────┬────────────┘               └────────────┬────────────┘
                         │                                         │
                         └────────────────────┬────────────────────┘
                                              │
                                              ▼
                  ┌────────────────────────────────────────────────────────┐
                  │       REAL-TIME CASH POSITION & FORWARD FORECASTER     │
                  │  • Reconciled Cash vs GL Cash Delta Snapshot           │
                  │  • 30/60/90-Day Forward Cash Trajectory                │
                  │  • Aging AR vs Aging AP Runway & Burn Rate             │
                  └───────────────────────────┬────────────────────────────┘
                                              │
                                              ▼
                  ┌────────────────────────────────────────────────────────┐
                  │      FULL-STACK DASHBOARD & ERP EXPORT INTERFACE       │
                  │  • FastAPI Backend + React 18 / Tailwind CSS UI        │
                  │  • Light / Dark Theme Support                          │
                  │  • Human Review Triage & Audit Trail Persistence       │
                  └────────────────────────────────────────────────────────┘
```

---

## ⚡ 2. The 5-Tier Reconciliation Engine

### Pass 0: Phantom Net-Zero UPI & Auto-Reversal Filter
* **Problem**: Failed UPI transactions or bounced transfers trigger an immediate debit (`-₹4,500`) and an auto-reversal credit (`+₹4,500`) in the bank feed. Standard matchers try to match these phantom entries against customer invoices.
* **Solution**: Pass 0 scans for equal and opposite same-source pairs on the same date/reference, groups them as closed self-balancing pairs, and prevents them from polluting open invoice reconciliations.

### Tier 1: Deterministic Exact & Paisa Round-off Matcher
* **Exact Mathematical Parity**: Matches records with identical reference tokens, currency, and exact amount ($\Delta \le 0.005$) within a 6-day window ($\text{Confidence} = 1.00$).
* **Precision Paisa Round-Off Rule**: Invoicing software and GST engines frequently round fractions of a paisa differently than bank settlements (e.g. ₹52,431.64 vs ₹52,432.00). Tier 1 detects variances $\le ₹0.99$, assigns $\text{Confidence} = 0.99$, and logs the exact round-off delta in the audit pack.

### Tier 1.5: Credit Notes, Debit Notes & Multi-Part Settlements
* **Credit Notes / Sales Returns**: Aggregates Gross Invoices (`INV-1030`, ₹85,000) and Credit Notes (`CN-1030`, -₹10,000) to form a net obligation (₹75,000) that perfectly matches the net Razorpay bank deposit.
* **Split Payments**: Links multiple partial bank lines settling a single large invoice.
* **Bulk Batches**: Links a single lump-sum bank payout settling multiple invoice items.

### Tier 2: Multi-Signal Fuzzy Matcher
* Computes composite similarity across 4 dimensions:
  1. **Amount Precision**: Magnitude distance and percentage deviation.
  2. **Entity & Merchant Similarity**: Levenshtein / SequenceMatcher ratio across vendor and party aliases.
  3. **Settlement Date Proximity**: Decay function across an adaptive 30-day window.
  4. **Reference Overlap**: Jaccard similarity of extracted alphanumeric tokens.
* Automatically merges pairs with $\text{Score} \ge 0.88$ if the score gap over the runner-up exceeds the policy near-tie margin.

### Tier 3: Autonomous AI Reasoner (Google Gemini 2.5 Flash + Fallback)
* Evaluates complex, unstructured, or fee-netted transactions that cannot be matched by pure heuristics.
* **Razorpay Standard MDR Solver**: Recognizes that Bank Payout = $\text{Invoice Gross} \times (1 - 0.0236)$ (2.0% MDR + 18% GST).
* **Indian TDS Deductions**: Resolves Section 194-O (1%), Section 194C (2%), and Section 194J (10%) withholding tax.
* **Smart Collect & Virtual Accounts**: Resolves UPI handles (`UPI/409823901/ZOMATO CORP`) to legal entities (`Zomato Media Pvt Ltd`).
* **Twin Collision Guard**: When two candidates share identical amounts and identical vendors with no distinguishing reference (e.g. twin invoices `INV-1022` vs `INV-1023`), the engine checks invoice confirmation status (`paid` vs `open`) and routes the open twin to exceptions with `AMBIGUOUS_TWIN_COLLISION` rather than guessing.

---

## 📊 3. Real-Time Cash Modeling & 30/60/90-Day Runway Forecaster

Reconciliation is the foundational data layer for cash management. Once records are reconciled, MatchMind computes forward liquidity:

1. **Reconciled Cash vs GL Cash**:
   $$\text{Reconciled Balance} = \text{Opening Cash} + \sum \text{Reconciled Bank Inflows} - \sum \text{Reconciled Bank Outflows}$$
   $$\text{Unreconciled Exposure} = \sum \text{Pending Bank Inflows} - \sum \text{Unidentified Bank Debits}$$

2. **30/60/90-Day Runway Forecaster**:
   * Analyzes historical 30-day operating velocity ($\text{Net Cash Flow}$).
   * Projects 4-step forward liquidity checkpoints: $\text{Today}$, $+30\text{ Days}$, $+60\text{ Days}$, $+90\text{ Days}$.
   * Categorizes AR (Receivables) and AP (Payables) into aging buckets:
     - `0–30 Days (Current)`
     - `31–60 Days (Aging)`
     - `61–90+ Days (Overdue / High Risk)`
   * Calculates net monthly burn rate and runway horizon (`X.X Months` or `Cash Flow Positive`).

---

## 🔄 4. Complete End-to-End Execution Flow

```
1. Ingestion:
   Bank CSV / Ledger CSV / Invoices CSV / GSTIN Bills
                      │
                      ▼
2. Normalization & Tokenization:
   - Amounts converted to float INR (₹)
   - Directionality standardized: Debit = Inflow/Credit in GL
   - Reference tokens extracted (UTR, RRN, INV, CN, GSTIN)
                      │
                      ▼
3. Autonomous Controller Execution:
   - Step 1: Pass 0 (Phantom Net-Zero UPI Reversals)
   - Step 2: Tier 1 (Exact Reference + Paisa Rounding + Stale UTR Check)
   - Step 3: Tier 1.5 (Credit Notes + Split/Bulk Settlements)
   - Step 4: Tier 2 (Multi-Signal Fuzzy Matching)
   - Step 5: Tier 3 (Gemini AI Reasoner on Ambiguous Pools)
   - Step 6: Exception Agent (Orphan & Collision Triage)
                      │
                      ▼
4. Financial Synthesis:
   - Compute Reconciled Cash Position & Exposure
   - Run 30/60/90-Day Forward Runway Modeling
   - Persist Markdown & JSON Audit Packs in `reports/`
                      │
                      ▼
5. Full-Stack Presentation:
   - FastAPI `/api/reconcile` and `/api/status` endpoints
   - Interactive React UI: 3-Way Grid, Trajectory Cards, Light/Dark Theme
```

---

## 📈 5. Benchmark Performance

Tested against the Indian Fintech & Razorpay test suite (`71` total records):

* **Recall**: **100.00%** (All true counterparts identified)
* **Precision**: **95.38%**
* **F1 Score**: **97.64%**
* **Raw Match Rate**: **97.18%** (69/71 records matched)
* **Validated Match Rate**: **91.55%** (Cluster-level parity with ground truth)
* **Exception Accuracy**: Exactly 3 true exceptions raised (`L-025` double post, `INV-1023` open twin invoice, `B-027` unidentified wire).
* **Execution Time**: **1.2 to 1.8 seconds** end-to-end.

---

## 🛠️ 6. Technology Stack

* **Backend**: Python 3.11/3.14, FastAPI, Pydantic v2, Uvicorn, Pandas.
* **AI & LLM**: Google Gemini API (`gemini-2.5-flash`), Deterministic Rule Reasoner.
* **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons.
* **DevOps**: Docker (Multi-stage build), GitHub Actions, Cloud Run / Render deployment.
