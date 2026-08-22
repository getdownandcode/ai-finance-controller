"""Simple file-based auth without external deps — opaque tokens + PBKDF2.

Users:  reports/users.json  { username: { salt, hash, created_at } }
Tokens: reports/auth_tokens.json { token: { username, expires_at } }
Sessions per user: reports/sessions/{username}/{batch_id}.json
"""
from __future__ import annotations

import hashlib
import json
import secrets
import time
from pathlib import Path
from typing import Optional

from fastapi import HTTPException, Request

from config import settings

USERS_FILE = settings.reports_dir / "users.json"
TOKENS_FILE = settings.reports_dir / "auth_tokens.json"
TOKEN_TTL_SECONDS = 7 * 24 * 3600  # 7 days

def _load_json(path: Path, default):
    try:
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        pass
    return default

def _save_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")

def _hash_password(password: str, salt_hex: str) -> str:
    salt = bytes.fromhex(salt_hex)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100_000)
    return dk.hex()

def _validate_username(username: str):
    u = username.strip()
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
    rec = users.get(username)
    if not rec:
        return False
    return _hash_password(password, rec["salt"]) == rec["hash"]

def create_token(username: str) -> str:
    token = secrets.token_urlsafe(32)
    tokens = _load_json(TOKENS_FILE, {})
    # cleanup expired
    now = time.time()
    tokens = {k: v for k, v in tokens.items() if v.get("expires_at", 0) > now}
    tokens[token] = {"username": username, "expires_at": now + TOKEN_TTL_SECONDS, "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    _save_json(TOKENS_FILE, tokens)
    return token

def verify_token(token: str) -> Optional[str]:
    if not token:
        return None
    tokens = _load_json(TOKENS_FILE, {})
    rec = tokens.get(token)
    if not rec:
        return None
    if rec.get("expires_at", 0) < time.time():
        # expired - delete
        try:
            del tokens[token]
            _save_json(TOKENS_FILE, tokens)
        except Exception:
            pass
        return None
    return rec.get("username")

def revoke_token(token: str):
    tokens = _load_json(TOKENS_FILE, {})
    if token in tokens:
        del tokens[token]
        _save_json(TOKENS_FILE, tokens)

def get_current_user(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    token = None
    if auth.startswith("Bearer "):
        token = auth[7:].strip()
    else:
        # also allow ?token= or cookie
        token = request.query_params.get("token")
    username = verify_token(token) if token else None
    if not username:
        raise HTTPException(status_code=401, detail="Not authenticated — please log in")
    return username

def get_optional_user(request: Request) -> Optional[str]:
    try:
        return get_current_user(request)
    except HTTPException:
        return None
