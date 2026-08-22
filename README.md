# AI Finance Controller — Production Multi-Source Reconciliation Agent

An enterprise-grade, autonomous financial reconciliation system that ingests multi-source feeds (**Bank Statements**, **General Ledger**, and **Invoices**) and closes the finance-ops loop with multi-tier deterministic matching, fuzzy scoring, and Google Gemini AI evidence reasoning.

---

## 🚀 Deployment Options (Git & Docker with CI/CD)

### Option 1: Automated CI/CD via GitHub Actions (Recommended)

This repository includes a preconfigured GitHub Actions workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

1. **Push to GitHub**:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/ai-finance-controller.git
   git branch -M main
   git push -u origin main
   ```

2. **Add GitHub Repository Secrets** (under *Settings > Secrets and variables > Actions*):
   - `GCP_PROJECT_ID`: Your Google Cloud project ID.
   - `GCP_SA_KEY`: JSON service account key with *Cloud Run Admin*, *Artifact Registry Writer*, and *Service Account User* roles.
   - `GEMINI_API_KEY`: Your Google Gemini API key.

3. **Deploy**:
   - Every push to `main` will automatically build the multi-stage Docker image, push it to Google Artifact Registry, and deploy to **Google Cloud Run**.

---

### Option 2: Continuous Deployment directly from Cloud Run Console

1. Open **[Google Cloud Console > Cloud Run](https://console.cloud.google.com/run)**.
2. Click **Create Service**.
3. Select **"Continuously deploy from a repository"**.
4. Authorize and select your GitHub repository.
5. Set Build Type to **Dockerfile**.
6. Under *Container, Networking, Security > Environment variables*, add:
   - `GEMINI_API_KEY`: `your_key_here`
   - `RECON_LLM_MODEL`: `gemini-2.5-flash`
7. Click **Create** — Cloud Run will build and host the live HTTPS URL!

---

### Option 3: Direct CLI Deployment via Cloud Build

If you have `gcloud` installed locally:

```bash
# Authenticate & set project
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT_ID

# Deploy directly
./deploy.sh
```

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

---

## 📂 Project Architecture

```text
├── Dockerfile                  # Multi-stage production container build (Node.js + Python)
├── deploy.sh                   # Direct Cloud Run deploy script
├── .github/workflows/
│   └── deploy.yml              # Automated GitHub Actions CI/CD pipeline
├── server.py                   # FastAPI backend server & static asset host
├── agents/                     # Controller, Matching, Exception, and Reporting agents
├── tools/                      # Normalizer, Exact, Fuzzy, LLM batch reasoning, Cash position
├── frontend/                   # React + Tailwind CSS light-theme Web UI
└── evaluation/                 # Scoring & multi-format report generator
```
