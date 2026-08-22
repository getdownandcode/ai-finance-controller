# AI Finance Controller — Production Multi-Source Reconciliation Agent

An autonomous financial reconciliation system that ingests multi-source feeds (**Bank Statements**, **General Ledger**, and **Invoices**) and closes the finance-ops loop with multi-tier deterministic matching, fuzzy scoring, and Gemini AI evidence reasoning.

---

## 🚀 Deployment (Render)

1. Push this repo to GitHub.
2. Render Dashboard → **New → Web Service** → connect the repo.
3. Runtime: **Docker** (uses the repo `Dockerfile` automatically).
4. Environment variables:
   - `GEMINI_API_KEY`: your Gemini API key
   - `RECON_LLM_MODEL`: `gemini-2.5-flash`
5. Plan: Free → **Create Web Service**.

Every push to the connected branch auto-deploys. Health check path: `/api/health`.

---

## 💻 Local Development

### 1. Install & Activate Environment
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Launch Local Web UI Server
```bash
python server.py
```
Open **[http://127.0.0.1:8000](http://127.0.0.1:8000)** in your browser.

Or run CLI directly:
```bash
python run_agent.py --llm off
python run_agent.py --bank-csv data/bank_feed.csv --ledger-csv data/ledger.csv --llm auto
```

---

## 📂 Project Architecture

```text
├── Dockerfile                # Multi-stage build (Node.js frontend + Python backend)
├── server.py                 # FastAPI backend + static asset host
├── app/pipeline.py           # Shared reconciliation pipeline (used by API & CLI)
├── config.py                 # Centralized env config
├── agents/                   # Controller, Matching, Exception, Reporting agents
├── tools/                    # Normalizer, Exact, Fuzzy, LLM reasoning, Cash position
├── frontend/                 # React + Tailwind Web UI
└── evaluation/               # Scoring & report generator
```
