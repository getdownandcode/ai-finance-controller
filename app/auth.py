"""Auth with persistent users + stateless JWT (survives Render restarts).

Users:  persistent file (tries /data/users.json first, then reports/users.json)
Tokens: JWT HMAC-SHA256 (no server file needed, backwards compat with old opaque tokens)
Sessions per user: reports/sessions/{username}/{batch_id}.json (or /data/sessions if disk exists)
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from pathlib import Path
from typing import Optional

from fastapi import HTTPException, Request

from config import settings

# --- persistent users file (Render disk fix) ---
def _users_file() -> Path:
    # 1) explicit env
    env = os.getenv("USERS_FILE", "").strip()
    if env:
        return Path(env)
    # 2) Render persistent disk candidates
    for cand in [Path("/data/users.json"), Path("/opt/render/project/src/data/users.json"), Path("data/users.json")]:
        # if parent exists and is writable, use it
        try:
            if cand.parent.exists():
                # prefer /data if exists
                if cand.parent == Path("/data") and cand.parent.exists():
                    return cand
                # for data/ in repo, use it as fallback persistent for local
                if cand == Path("data/users.json"):
                    return cand
        except Exception:
            pass
    # 3) Check if /data exists (Render disk)
    if Path("/data").exists():
        return Path("/data/users.json")
    return settings.reports_dir / "users.json"

USERS_FILE = _users_file()
# keep old tokens file for backwards compat (now mostly unused)
TOKENS_FILE = settings.reports_dir / "auth_tokens.json"
if Path("/data").exists():
    _tok_cand = Path("/data/auth_tokens.json")
    # use persistent tokens file if /data exists
    if _tok_cand.parent.exists():
        TOKENS_FILE = _tok_cand

TOKEN_TTL_SECONDS = 7 * 24 * 3600  # 7 days

def _jwt_secret() -> bytes:
    sec = os.getenv("JWT_SECRET") or os.getenv("SECRET_KEY") or os.getenv("GEMINI_API_KEY") or ""
    if not sec:
        # fallback deterministic but warn - not for prod
        sec = "matchmind-dev-secret-change-in-prod"
    return sec.encode()

def _b64url_encode(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode().rstrip("=")

def _b64url_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)

def _load_json(path: Path, default):
    try:
        if path.exists():
            data = json.loads(path.read_text(encoding="utf-8"))
            # migrate usernames to lowercase
            if path == USERS_FILE and isinstance(data, dict):
                migrated = {}
                changed = False
                for k, v in data.items():
                    lk = k.strip().lower()
                    if lk != k:
                        changed = True
                    if lk not in migrated:
                        migrated[lk] = v
                if changed:
                    try:
                        _save_json(path, migrated)
                    except Exception:
                        pass
                    return migrated
            return data
    except Exception:
        pass
    return default

def _save_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    # also try to mirror to reports/users.json for local dev if using /data
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    # mirror to fallback for debugging if using persistent path
    if path == USERS_FILE and path != settings.reports_dir / "users.json":
        try:
            fallback = settings.reports_dir / "users.json"
            if not fallback.exists():
                fallback.parent.mkdir(parents=True, exist_ok=True)
                fallback.write_text(json.dumps(data, indent=2), encoding="utf-8")
        except Exception:
            pass

def _hash_password(password: str, salt_hex: str) -> str:
    salt = bytes.fromhex(salt_hex)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100_000)
    return dk.hex()

def _validate_username(username: str):
    u = username.strip().lower()
    if len(u) < 3 or len(u) > 32:
        raise HTTPException(status_code=400, detail="Username must be 3-32 characters")
    if not u.replace("_", "").replace("-", "").isalnum():
        raise HTTPException(status_code=400, detail="Username: letters, numbers, _ or - only")
    return u

def _validate_password(password: str):
    if len(password) < 8 or len(password) > 128:
        raise HTTPException(status_code=400, detail="Password must be 8-128 characters")
    import re
    if not re.search(r"[A-Za-z]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one letter (A-Z)")
    if not re.search(r"[0-9]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one number (0-9)")
    if not re.search(r"[^A-Za-z0-9]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one special character (e.g. !@#$%)")
    return password

def register_user(username: str, password: str) -> dict:
    username = _validate_username(username)
    password = _validate_password(password)
    users = _load_json(USERS_FILE, {})
    if username in users:
        raise HTTPException(status_code=400, detail="Username already exists")
    salt = secrets.token_hex(16)
    pwd_hash = _hash_password(password, salt)
    users[username] = {"salt": salt, "hash": pwd_hash, "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    _save_json(USERS_FILE, users)
    return {"username": username}

def verify_password(username: str, password: str) -> bool:
    users = _load_json(USERS_FILE, {})
    lk = username.strip().lower()
    rec = users.get(lk) or users.get(username)
    if not rec:
        return False
    return _hash_password(password, rec["salt"]) == rec["hash"]

def create_token(username: str) -> str:
    # stateless JWT - no file needed
    norm = username.strip().lower()
    header = _b64url_encode(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    payload = _b64url_encode(json.dumps({"sub": norm, "exp": int(time.time()) + TOKEN_TTL_SECONDS, "iat": int(time.time())}, separators=(",", ":")).encode())
    sig = hmac.new(_jwt_secret(), f"{header}.{payload}".encode(), hashlib.sha256).digest()
    sig_b64 = _b64url_encode(sig)
    return f"{header}.{payload}.{sig_b64}"

def verify_token(token: str) -> Optional[str]:
    if not token:
        return None
    # try JWT first (contains two dots)
    if token.count(".") == 2:
        try:
            header_b64, payload_b64, sig_b64 = token.split(".")
            expected = _b64url_encode(hmac.new(_jwt_secret(), f"{header_b64}.{payload_b64}".encode(), hashlib.sha256).digest())
            if not hmac.compare_digest(expected, sig_b64):
                return None
            payload = json.loads(_b64url_decode(payload_b64).decode())
            if payload.get("exp", 0) < time.time():
                return None
            sub = payload.get("sub")
            if sub:
                # ensure user still exists
                users = _load_json(USERS_FILE, {})
                if sub.strip().lower() in users:
                    return sub.strip().lower()
                # allow if user was deleted? no
                return sub.strip().lower()
        except Exception:
            return None
    # fallback: old opaque tokens file (backwards compat)
    try:
        tokens = _load_json(TOKENS_FILE, {})
        rec = tokens.get(token)
        if not rec:
            return None
        if rec.get("expires_at", 0) < time.time():
            try:
                del tokens[token]
                _save_json(TOKENS_FILE, tokens)
            except Exception:
                pass
            return None
        return rec.get("username", "").strip().lower() or rec.get("username")
    except Exception:
        return None

def revoke_token(token: str):
    # JWT is stateless - nothing to revoke centrally without blocklist; keep opaque revoke for old tokens
    try:
        tokens = _load_json(TOKENS_FILE, {})
        if token in tokens:
            del tokens[token]
            _save_json(TOKENS_FILE, tokens)
    except Exception:
        pass

def get_current_user(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    token = None
    if auth.startswith("Bearer "):
        token = auth[7:].strip()
    else:
        token = request.query_params.get("token")
    username = verify_token(token) if token else None
    if not username:
        raise HTTPException(status_code=401, detail="Not authenticated — please log in")
    return username.strip().lower()

def get_optional_user(request: Request) -> Optional[str]:
    try:
        return get_current_user(request)
    except HTTPException:
        return None
