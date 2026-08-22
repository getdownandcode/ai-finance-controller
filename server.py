"""FastAPI Backend Server for AI Finance Controller Web UI."""
from __future__ import annotations

import io
import json
import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import pandas as pd

from agents.controller_agent import AgentConfig, ControllerAgent
from agents.reporting_agent import ReportingAgent
from evaluation.score import evaluate, load_ground_truth
from generate_data import generate
from tools.cash_position import cash_position
from tools.normalize import Record, parse_records_from_dataframe

app = FastAPI(title="AI Finance Controller API", version="1.0.0")

# Enable CORS for Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

REPORTS_DIR = Path("reports")
REPORTS_DIR.mkdir(parents=True, exist_ok=True)
DIST_DIR = Path("frontend/dist")


@app.get("/api/status")
def get_status():
    has_gemini = bool(os.environ.get("GEMINI_API_KEY", "").strip())
    model = os.environ.get("RECON_LLM_MODEL", "gemini-2.5-flash")
    return {
        "status": "ready",
        "has_gemini_key": has_gemini,
        "gemini_model": model,
        "supported_sources": ["bank", "ledger", "invoice"],
        "max_records": 5000
    }


def _run_reconciliation_pipeline(
    bank_df: pd.DataFrame | None,
    ledger_df: pd.DataFrame | None,
    invoices_df: pd.DataFrame | None,
    gt_df: pd.DataFrame | None = None,
    bank_opening: float = 42500.0,
    ledger_opening: float = 42500.0,
    llm_mode: str = "auto",
    batch_id: str = "custom_run"
):
    bank_records = parse_records_from_dataframe(bank_df, "bank") if bank_df is not None and not bank_df.empty else []
    ledger_records = parse_records_from_dataframe(ledger_df, "ledger") if ledger_df is not None and not ledger_df.empty else []
    invoice_records = parse_records_from_dataframe(invoices_df, "invoice") if invoices_df is not None and not invoices_df.empty else []

    all_records: dict[str, Record] = {}
    for r in bank_records + ledger_records + invoice_records:
        all_records[r.record_id] = r

    if not all_records:
        raise HTTPException(status_code=400, detail="No valid records could be parsed from the provided files.")

    meta = {
        "batch_id": batch_id,
        "opening_balances": {"bank": bank_opening, "ledger": ledger_opening}
    }
    cfg = AgentConfig(llm_mode=llm_mode)

    # Run Autonomous Reconciliation Controller Loop
    controller = ControllerAgent(all_records, meta, cfg)
    state = controller.run()

    # Ground Truth mapping if provided
    gt_map = None
    if gt_df is not None and not gt_df.empty:
        try:
            cols = {str(c).lower().strip(): c for c in gt_df.columns}
            rec_col = cols.get("record_id", cols.get("id"))
            grp_col = cols.get("group_id", cols.get("group"))
            if rec_col and grp_col:
                gt_map = {str(r[rec_col]).strip(): str(r[grp_col]).strip() for _, r in gt_df.iterrows()}
        except Exception:
            gt_map = None

    metrics = evaluate(state, gt_map, all_records)
    cash = cash_position(all_records, state.matched_ids(), state.exception_ids, meta)

    # Write reports to disk
    reporter = ReportingAgent(state, metrics, cash, meta, cfg, reports_dir=REPORTS_DIR)
    reporter.write_all()

    # Build grouped matches view for UI
    matched_clusters = []
    for g in state.final_groups():
        if len(g) >= 2:
            cluster_members = [all_records[rid].model_dump() for rid in g if rid in all_records]
            method = state.group_method_of(next(iter(g)))
            matched_clusters.append({
                "group_id": f"GRP-{len(matched_clusters)+1:03d}",
                "method": method,
                "count": len(cluster_members),
                "members": cluster_members
            })

    exceptions_list = [e.model_dump() for e in state.exceptions]

    return {
        "batch_id": batch_id,
        "total_records": len(all_records),
        "source_counts": {
            "bank": len(bank_records),
            "ledger": len(ledger_records),
            "invoice": len(invoice_records)
        },
        "metrics": metrics,
        "cash_position": cash,
        "matched_clusters": matched_clusters,
        "exceptions": exceptions_list,
        "audit_trail": state.audit,
        "pipeline_stats": state.stats,
        "reasoner_mode": state.stats.get("reasoner_mode", llm_mode)
    }


@app.post("/api/reconcile")
async def reconcile_custom_files(
    bank_file: Optional[UploadFile] = File(None),
    ledger_file: Optional[UploadFile] = File(None),
    invoices_file: Optional[UploadFile] = File(None),
    ground_truth_file: Optional[UploadFile] = File(None),
    bank_opening: float = Form(42500.0),
    ledger_opening: float = Form(42500.0),
    llm_mode: str = Form("auto")
):
    try:
        bank_df = pd.read_csv(io.BytesIO(await bank_file.read())) if bank_file else None
        ledger_df = pd.read_csv(io.BytesIO(await ledger_file.read())) if ledger_file else None
        invoices_df = pd.read_csv(io.BytesIO(await invoices_file.read())) if invoices_file else None
        gt_df = pd.read_csv(io.BytesIO(await ground_truth_file.read())) if ground_truth_file else None

        result = _run_reconciliation_pipeline(
            bank_df=bank_df,
            ledger_df=ledger_df,
            invoices_df=invoices_df,
            gt_df=gt_df,
            bank_opening=bank_opening,
            ledger_opening=ledger_opening,
            llm_mode=llm_mode,
            batch_id=f"custom_upload_{int(pd.Timestamp.now().timestamp())}"
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/reconcile-demo")
def reconcile_demo(
    seed: int = Form(42),
    llm_mode: str = Form("auto")
):
    try:
        data_dir = Path("data")
        generate(seed=seed, data_dir=str(data_dir))

        bank_df = pd.read_csv(data_dir / "bank_feed.csv")
        ledger_df = pd.read_csv(data_dir / "ledger.csv")
        invoices_df = pd.read_csv(data_dir / "invoices.csv")
        gt_df = pd.read_csv(data_dir / "ground_truth.csv")

        meta = json.loads((data_dir / "batch_meta.json").read_text())
        b_open = meta.get("opening_balances", {}).get("bank", 42500.0)
        l_open = meta.get("opening_balances", {}).get("ledger", 42500.0)

        result = _run_reconciliation_pipeline(
            bank_df=bank_df,
            ledger_df=ledger_df,
            invoices_df=invoices_df,
            gt_df=gt_df,
            bank_opening=b_open,
            ledger_opening=l_open,
            llm_mode=llm_mode,
            batch_id=meta.get("batch_id", f"demo_seed_{seed}")
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=404, detail="File not generated yet")
    
    return FileResponse(file_path, media_type=media_type, filename=filename)


# Serve built React static files
if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        index_file = DIST_DIR / "index.html"
        return FileResponse(index_file)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
