"""FastAPI backend for MatchMind (formerly AI Finance Controller).

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

from app.auth import create_token, get_current_user, register_user, revoke_token, verify_password, verify_token
from app.pipeline import run_reconciliation
from config import settings
from config.policy_loader import Policy
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
# Persistent disk on Render (if you add a Disk at /data in render.yaml/dashboard, sessions survive deploys)
if Path("/data").exists():
    SESSIONS_DIR = Path("/data/sessions")
else:
    SESSIONS_DIR = REPORTS_DIR / "sessions"
SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
DIST_DIR = Path("frontend/dist")

MAX_UPLOAD_BYTES = settings.max_upload_bytes
MAX_RECORDS = settings.max_records
ALLOWED_LLM_MODES = {"auto", "off", "gemini"}
ALLOWED_GOALS = {"reconcile", "reconcile_all", "calculate_cash", "triage", "report"}


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    log.info("%s %s -> %d (%.0fms)", request.method, request.url.path,
             response.status_code, (time.time() - start) * 1000)
    return response


# ---------------------------------------------------------------------------
# Session persistence (ChatGPT-like) — per-user isolation
# ---------------------------------------------------------------------------
def _user_sessions_dir(username: str) -> Path:
    safe_user = "".join(c if c.isalnum() or c in "-_." else "_" for c in username.strip().lower())[:40]
    d = SESSIONS_DIR / safe_user
    d.mkdir(parents=True, exist_ok=True)
    return d

def _save_session(payload: dict, username: str | None = None) -> None:
    """Persist full reconciliation payload so history survives restarts."""
    try:
        bid = payload.get("batch_id", f"session_{int(time.time())}")
        # sanitize batch_id for filesystem
        safe = "".join(c if c.isalnum() or c in "-_." else "_" for c in bid)[:80]
        payload["_saved_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        if username:
            payload["_owner"] = username
            target = _user_sessions_dir(username) / f"{safe}.json"
        else:
            # legacy fallback (pre-auth sessions)
            target = SESSIONS_DIR / f"{safe}.json"
        target.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
        # keep only last 50 sessions per user
        base = _user_sessions_dir(username) if username else SESSIONS_DIR
        sessions = sorted(base.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
        for p in sessions[50:]:
            try:
                p.unlink()
            except Exception:
                pass
    except Exception:
        log.exception("Failed to save session")


def _list_sessions(username: str | None = None) -> list[dict]:
    out = []
    base = _user_sessions_dir(username) if username else SESSIONS_DIR
    # also include legacy flat files for migration
    candidates = list(base.glob("*.json"))
    if username:
        # also consider legacy flat files owned by this user (old _owner field)
        for p in SESSIONS_DIR.glob("*.json"):
            if p.is_file():
                try:
                    d = json.loads(p.read_text(encoding="utf-8"))
                    if d.get("_owner") == username and p not in candidates:
                        candidates.append(p)
                except Exception:
                    continue
    for p in sorted(candidates, key=lambda x: x.stat().st_mtime, reverse=True):
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
            out.append({
                "batch_id": data.get("batch_id"),
                "saved_at": data.get("_saved_at") or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(p.stat().st_mtime)),
                "total_records": data.get("total_records", 0),
                "source_counts": data.get("source_counts", {}),
                "metrics": {
                    "raw_match_rate": data.get("metrics", {}).get("raw_match_rate"),
                    "matched_records": data.get("metrics", {}).get("matched_records"),
                    "f1": data.get("metrics", {}).get("f1"),
                    "precision": data.get("metrics", {}).get("precision"),
                    "recall": data.get("metrics", {}).get("recall"),
                    "exceptions": data.get("metrics", {}).get("exceptions"),
                },
                "cash_position": {
                    "reconciled_difference": data.get("cash_position", {}).get("reconciled_difference"),
                },
                "reasoner_mode": data.get("reasoner_mode"),
                "pipeline_stats": data.get("pipeline_stats", {}),
            })
        except Exception:
            continue
    return out


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
    policy = Policy.load()
    from tools.registry import ensure_registered, all_tools
    ensure_registered()
    tools_meta = {k: {"cost": v.cost, "risk_level": v.risk_level, "requires_approval": v.requires_approval, "changes_external_state": v.changes_external_state, "description": v.description} for k, v in all_tools().items()}
    return {
        "status": "ready",
        "has_gemini_key": settings.has_gemini_key,
        "gemini_model": settings.recon_llm_model,
        "supported_sources": ["bank", "ledger", "invoice"],
        "max_records": MAX_RECORDS,
        "allowed_goals": sorted(ALLOWED_GOALS),
        "goal": "reconcile",
        "policy": policy.model_dump(),
        "tools": tools_meta,
    }


@app.get("/api/policy")
def get_policy(request: Request):
    get_current_user(request)
    return Policy.load().model_dump()


@app.get("/api/tools")
def list_tools(request: Request):
    get_current_user(request)
    from tools.registry import all_tools
    from tools.registry import ensure_registered
    ensure_registered()
    return {k: {"description": v.description, "cost": v.cost, "risk_level": v.risk_level, "requires_approval": v.requires_approval, "changes_external_state": v.changes_external_state, "input_schema": v.input_schema} for k, v in all_tools().items()}


# ---------------------------------------------------------------------------
# Auth (simple username/password → opaque token)
# ---------------------------------------------------------------------------
@app.post("/api/auth/register")
def auth_register(payload: dict):
    username = str(payload.get("username") or "").strip()
    password = str(payload.get("password") or "")
    reg = register_user(username, password)
    token = create_token(reg["username"])
    return {"username": reg["username"], "token": token}


@app.post("/api/auth/login")
def auth_login(payload: dict):
    username = str(payload.get("username") or "").strip()
    password = str(payload.get("password") or "")
    if not verify_password(username, password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    # normalize for token/session isolation (case-insensitive)
    norm = username.strip().lower()
    token = create_token(norm)
    return {"username": norm, "token": token}


@app.post("/api/auth/logout")
def auth_logout(request: Request):
    auth = request.headers.get("Authorization", "")
    token = auth[7:].strip() if auth.startswith("Bearer ") else request.query_params.get("token", "")
    if token:
        revoke_token(token)
    return {"ok": True}


@app.get("/api/auth/me")
def auth_me(request: Request):
    username = get_current_user(request)
    return {"username": username}


@app.post("/api/reconcile")
async def reconcile_custom_files(
    request: Request,
    bank_file: Optional[UploadFile] = File(None),
    ledger_file: Optional[UploadFile] = File(None),
    invoices_file: Optional[UploadFile] = File(None),
    ground_truth_file: Optional[UploadFile] = File(None),
    bank_opening: float = Form(42500.0),
    ledger_opening: float = Form(42500.0),
    llm_mode: str = Form("auto"),
    goal: str = Form("reconcile"),
):
    username = get_current_user(request)
    if llm_mode not in ALLOWED_LLM_MODES:
        raise HTTPException(status_code=400, detail=f"llm_mode must be one of {ALLOWED_LLM_MODES}")
    if goal not in ALLOWED_GOALS:
        raise HTTPException(status_code=400, detail=f"goal must be one of {ALLOWED_GOALS}")
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

        payload = run_reconciliation(
            bank_df=bank_df, ledger_df=ledger_df, invoices_df=invoices_df, gt_df=gt_df,
            bank_opening=bank_opening, ledger_opening=ledger_opening,
            llm_mode=llm_mode,
            batch_id=f"custom_upload_{int(time.time())}",
            reports_dir=REPORTS_DIR,
            goal=goal,
        )
        payload["_owner"] = username
        _save_session(payload, username)
        return payload
    except HTTPException:
        raise
    except Exception as exc:
        log.exception("reconcile failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/reconcile-demo")
def reconcile_demo(request: Request, seed: int = Form(42), llm_mode: str = Form("auto"), goal: str = Form("reconcile")):
    username = get_current_user(request)
    if llm_mode not in ALLOWED_LLM_MODES:
        raise HTTPException(status_code=400, detail=f"llm_mode must be one of {ALLOWED_LLM_MODES}")
    if goal not in ALLOWED_GOALS:
        raise HTTPException(status_code=400, detail=f"goal must be one of {ALLOWED_GOALS}")
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

        payload = run_reconciliation(
            bank_df=bank_df, ledger_df=ledger_df, invoices_df=invoices_df, gt_df=gt_df,
            bank_opening=meta.get("opening_balances", {}).get("bank", 42500.0),
            ledger_opening=meta.get("opening_balances", {}).get("ledger", 42500.0),
            llm_mode=llm_mode,
            batch_id=meta.get("batch_id", f"demo_seed_{seed}"),
            reports_dir=REPORTS_DIR,
            goal=goal,
        )
        payload["_owner"] = username
        _save_session(payload, username)
        return payload
    except HTTPException:
        raise
    except Exception as exc:
        log.exception("reconcile-demo failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# --- Session history (ChatGPT-like) — per-user ---
@app.get("/api/sessions")
def list_sessions(request: Request):
    username = get_current_user(request)
    return {"sessions": _list_sessions(username)}


@app.get("/api/session/{batch_id}")
def get_session(batch_id: str, request: Request):
    username = get_current_user(request)
    safe = "".join(c if c.isalnum() or c in "-_." else "_" for c in batch_id)[:80]
    # try per-user dir first, then legacy flat
    p = _user_sessions_dir(username) / f"{safe}.json"
    if not p.exists():
        p = SESSIONS_DIR / f"{safe}.json"
        if p.exists():
            try:
                data = json.loads(p.read_text(encoding="utf-8"))
                if data.get("_owner") and data.get("_owner") != username:
                    raise HTTPException(status_code=404, detail="Session not found")
            except HTTPException:
                raise
            except Exception:
                pass
        else:
            raise HTTPException(status_code=404, detail="Session not found")
    data = json.loads(p.read_text(encoding="utf-8"))
    # enforce ownership
    if data.get("_owner") and data.get("_owner") != username:
        raise HTTPException(status_code=404, detail="Session not found")
    return data


@app.post("/api/session/restore")
def restore_session(payload: dict, request: Request):
    username = get_current_user(request)
    # Allow browser to re-persist a localStorage session that never made it to disk (e.g. 354-rec phantom)
    try:
        if not payload.get("batch_id"):
            raise HTTPException(status_code=400, detail="batch_id required")
        payload["_owner"] = username
        _save_session(payload, username)
        return {"restored": payload.get("batch_id")}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.delete("/api/session/{batch_id}")
def delete_session(batch_id: str, request: Request):
    username = get_current_user(request)
    safe = "".join(c if c.isalnum() or c in "-_." else "_" for c in batch_id)[:80]
    p = _user_sessions_dir(username) / f"{safe}.json"
    legacy = SESSIONS_DIR / f"{safe}.json"
    if p.exists():
        p.unlink()
        return {"deleted": batch_id}
    if legacy.exists():
        try:
            data = json.loads(legacy.read_text(encoding="utf-8"))
            if data.get("_owner") in (None, username):
                legacy.unlink()
                return {"deleted": batch_id}
        except Exception:
            pass
    raise HTTPException(status_code=404, detail="Session not found")


@app.post("/api/approve/{batch_id}/{approval_id}")
def approve_action(batch_id: str, approval_id: str, request: Request, payload: dict | None = None):
    username = get_current_user(request)
    safe = "".join(c if c.isalnum() or c in "-_." else "_" for c in batch_id)[:80]
    p = _user_sessions_dir(username) / f"{safe}.json"
    if not p.exists():
        p = SESSIONS_DIR / f"{safe}.json"
    if not p.exists():
        raise HTTPException(status_code=404, detail="Session not found")
    data = json.loads(p.read_text(encoding="utf-8"))
    if data.get("_owner") and data.get("_owner") != username:
        raise HTTPException(status_code=404, detail="Session not found")
    # Mark approval as approved in stored trace
    trace = data.get("agent_trace", {})
    approvals = trace.get("pending_approvals", []) if isinstance(trace, dict) else []
    # Also check top-level pending_approvals
    top_pending = data.get("pending_approvals", [])
    found = False
    for lst in (approvals, top_pending):
        for a in lst:
            if a.get("id") == approval_id:
                a["status"] = "approved"
                found = True
    if not found:
        raise HTTPException(status_code=404, detail="Approval not found")
    data["agent_status"] = "approved"
    p.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")
    return {"approved": approval_id, "batch_id": batch_id}


@app.post("/api/reject/{batch_id}/{approval_id}")
def reject_action(batch_id: str, approval_id: str, request: Request):
    username = get_current_user(request)
    safe = "".join(c if c.isalnum() or c in "-_." else "_" for c in batch_id)[:80]
    p = _user_sessions_dir(username) / f"{safe}.json"
    if not p.exists():
        p = SESSIONS_DIR / f"{safe}.json"
    if not p.exists():
        raise HTTPException(status_code=404, detail="Session not found")
    data = json.loads(p.read_text(encoding="utf-8"))
    if data.get("_owner") and data.get("_owner") != username:
        raise HTTPException(status_code=404, detail="Session not found")
    trace = data.get("agent_trace", {})
    approvals = trace.get("pending_approvals", []) if isinstance(trace, dict) else []
    top_pending = data.get("pending_approvals", [])
    found = False
    for lst in (approvals, top_pending):
        for a in lst:
            if a.get("id") == approval_id:
                a["status"] = "rejected"
                found = True
    if not found:
        raise HTTPException(status_code=404, detail="Approval not found")
    data["agent_status"] = "blocked"
    p.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")
    return {"rejected": approval_id, "batch_id": batch_id}


@app.get("/api/download/{report_type}")
def download_report(report_type: str, request: Request):
    get_current_user(request)
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
        # Serve real static files from dist (favicon, matchmind-logo, etc.)
        if full_path and full_path != "/":
            candidate = DIST_DIR / full_path
            # prevent path traversal
            try:
                candidate.resolve().relative_to(DIST_DIR.resolve())
            except Exception:
                return FileResponse(DIST_DIR / "index.html")
            if candidate.is_file():
                return FileResponse(candidate)
        return FileResponse(DIST_DIR / "index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
