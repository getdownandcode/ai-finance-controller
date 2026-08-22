# AI Finance Controller — Production Multi-Source Reconciliation Agent

An autonomous financial reconciliation system that ingests multi-source feeds (**Bank Statements**, **General Ledger**, and **Invoices**) and closes the finance-ops loop with multi-tier deterministic matching, fuzzy scoring, and Gemini AI evidence reasoning.

---

## 🚀 Deployment (Fly.io)

### Automated CI/CD via GitHub Actions

1. **Push to GitHub**:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/ai-finance-controller.git
   git branch -M main
   git push -u origin main
   ```

2. **Create Fly.io app & token**:
   ```bash
   brew install flyctl
   fly auth login
   fly launch --no-deploy   # uses existing fly.toml
   fly tokens create deploy -x 999999h  # copy token
   ```

3. **Add GitHub Secret** (*Settings > Secrets and variables > Actions*):
   - `FLY_API_TOKEN`: token from above
   - Add `GEMINI_API_KEY` as Fly secret: `fly secrets set GEMINI_API_KEY=your_key`

4. **Deploy**: Every push to `main` triggers `.github/workflows/fly.yml` → `fly deploy --remote-only`. Or deploy manually: `fly deploy`.

### Manual Deploy

```bash
fly secrets set GEMINI_API_KEY=your_key RECON_LLM_MODEL=gemini-2.5-flash
fly deploy --remote-only
fly open
fly logs
```

Health check: `https://<app>.fly.dev/api/health`

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
├── fly.toml                  # Fly.io app config (region bom, healthcheck)
├── Dockerfile                # Multi-stage build (Node.js frontend + Python backend)
├── .github/workflows/fly.yml # GitHub Actions -> fly deploy
├── server.py                 # FastAPI backend + static asset host
├── app/pipeline.py           # Shared reconciliation pipeline (used by API & CLI)
├── config.py                 # Centralized env config
├── agents/                   # Controller, Matching, Exception, Reporting agents
├── tools/                    # Normalizer, Exact, Fuzzy, LLM reasoning, Cash position
├── frontend/                 # React + Tailwind Web UI
└── evaluation/               # Scoring & report generator
```
