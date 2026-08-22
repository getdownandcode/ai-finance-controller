"""FastAPI backend for AI Finance Controller.

Production hardening:
- Centralized config (config.py)
- Structured logging (no stray prints in request path)
- Health endpoint for load-balancers (Render / Docker)
- Validated CORS (no wildcard + credentials)
- Upload size + record-count guards
- Shared reconciliation pipeline (app/pipeline.py)
"""
from __future__ import annotations

import io
import json
import logging
import time
from pathlib import Path
from typing import Optional

import pandas as pd
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.pipeline import run_reconciliation
from config import settings
from generate_data import generate

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(level=getattr(logging, settings.log_level, logging.INFO),
                    format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(title="AI Finance Controller API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_allow_origins),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

REPORTS_DIR = settings.reports_dir
REPORTS_DIR.mkdir(parents=True, exist_ok=True)
DIST_DIR = Path("frontend/dist")

MAX_UPLOAD_BYTES = settings.max_upload_bytes
MAX_RECORDS = settings.max_records
ALLOWED_LLM_MODES = {"auto", "off", "gemini"}


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    log.info("%s %s -> %d (%.0fms)", request.method, request.url.path,
             response.status_code, (time.time() - start) * 1000)
    return response


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _read_csv_or_none(upload: UploadFile | None, label: str) -> pd.DataFrame | None:
    if upload is None or not upload.filename:
        return None
    # Read at most max+1 bytes so an oversized file is rejected without buffering it all
    raw = upload.file.read(MAX_UPLOAD_BYTES + 1)
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"{label} file too large (>{MAX_UPLOAD_BYTES} bytes)")
    if len(raw) == 0:
        return None
    try:
        return pd.read_csv(io.BytesIO(raw))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid CSV for {label}: {exc}") from exc


def _validate_opening(v: float, label: str) -> float:
    if abs(v) > 1e9:
        raise HTTPException(status_code=400, detail=f"{label} out of range")
    return float(v)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/status")
def get_status():
    return {
        "status": "ready",
        "has_gemini_key": settings.has_gemini_key,
        "gemini_model": settings.recon_llm_model,
        "supported_sources": ["bank", "ledger", "invoice"],
        "max_records": MAX_RECORDS,
    }


@app.post("/api/reconcile")
async def reconcile_custom_files(
    bank_file: Optional[UploadFile] = File(None),
    ledger_file: Optional[UploadFile] = File(None),
    invoices_file: Optional[UploadFile] = File(None),
    ground_truth_file: Optional[UploadFile] = File(None),
    bank_opening: float = Form(42500.0),
    ledger_opening: float = Form(42500.0),
    llm_mode: str = Form("auto"),
):
    if llm_mode not in ALLOWED_LLM_MODES:
        raise HTTPException(status_code=400, detail=f"llm_mode must be one of {ALLOWED_LLM_MODES}")
    _validate_opening(bank_opening, "bank_opening")
    _validate_opening(ledger_opening, "ledger_opening")

    try:
        bank_df = _read_csv_or_none(bank_file, "bank")
        ledger_df = _read_csv_or_none(ledger_file, "ledger")
        invoices_df = _read_csv_or_none(invoices_file, "invoices")
        gt_df = _read_csv_or_none(ground_truth_file, "ground_truth")

        total_rows = sum(len(df) for df in (bank_df, ledger_df, invoices_df) if df is not None)
        if total_rows > MAX_RECORDS:
            raise HTTPException(status_code=400, detail=f"Too many records ({total_rows} > {MAX_RECORDS})")
        if total_rows == 0:
            raise HTTPException(status_code=400, detail="No records found in uploaded files")

        return run_reconciliation(
            bank_df=bank_df, ledger_df=ledger_df, invoices_df=invoices_df, gt_df=gt_df,
            bank_opening=bank_opening, ledger_opening=ledger_opening,
            llm_mode=llm_mode,
            batch_id=f"custom_upload_{int(time.time())}",
            reports_dir=REPORTS_DIR,
        )
    except HTTPException:
        raise
    except Exception as exc:
        log.exception("reconcile failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/reconcile-demo")
def reconcile_demo(seed: int = Form(42), llm_mode: str = Form("auto")):
    if llm_mode not in ALLOWED_LLM_MODES:
        raise HTTPException(status_code=400, detail=f"llm_mode must be one of {ALLOWED_LLM_MODES}")
    if not 0 <= seed <= 1_000_000:
        raise HTTPException(status_code=400, detail="seed out of range")
    try:
        data_dir = settings.data_dir
        generate(seed=seed, data_dir=str(data_dir))

        bank_df = pd.read_csv(data_dir / "bank_feed.csv")
        ledger_df = pd.read_csv(data_dir / "ledger.csv")
        invoices_df = pd.read_csv(data_dir / "invoices.csv")
        gt_df = pd.read_csv(data_dir / "ground_truth.csv")
        meta = json.loads((data_dir / "batch_meta.json").read_text())

        return run_reconciliation(
            bank_df=bank_df, ledger_df=ledger_df, invoices_df=invoices_df, gt_df=gt_df,
            bank_opening=meta.get("opening_balances", {}).get("bank", 42500.0),
            ledger_opening=meta.get("opening_balances", {}).get("ledger", 42500.0),
            llm_mode=llm_mode,
            batch_id=meta.get("batch_id", f"demo_seed_{seed}"),
            reports_dir=REPORTS_DIR,
        )
    except HTTPException:
        raise
    except Exception as exc:
        log.exception("reconcile-demo failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/download/{report_type}")
def download_report(report_type: str):
    mapping = {
        "markdown": ("recon_report.md", "text/markdown"),
        "json": ("recon_report.json", "application/json"),
        "csv": ("exceptions.csv", "text/csv"),
        "audit": ("audit_log.json", "application/json"),
    }
    if report_type not in mapping:
        raise HTTPException(status_code=404, detail="Report type not found")
    filename, media_type = mapping[report_type]
    file_path = REPORTS_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not generated yet. Run a reconciliation first.")
    return FileResponse(file_path, media_type=media_type, filename=filename)


# Serve built React app (must be after /api routes)
if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        # Don't intercept API or download routes
        if full_path.startswith("api/"):
            return JSONResponse(status_code=404, content={"detail": "Not found"})
        return FileResponse(DIST_DIR / "index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
