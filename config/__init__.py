"""Centralized application configuration.

All env-driven settings live here so server.py, run_agent.py and tools
read from a single source of truth.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

@dataclass(frozen=True)
class Settings:
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "").strip()
    recon_llm_model: str = os.getenv("RECON_LLM_MODEL", "gemini-2.5-flash").strip()
    max_records: int = int(os.getenv("MAX_RECORDS", "5000"))
    max_upload_bytes: int = int(os.getenv("MAX_UPLOAD_BYTES", str(5 * 1024 * 1024)))  # 5 MB
    cors_allow_origins: tuple[str, ...] = tuple(
        o.strip() for o in os.getenv("CORS_ALLOW_ORIGINS", "").split(",") if o.strip()
    ) or ("http://localhost:3000", "http://127.0.0.1:3000")
    reports_dir: Path = Path(os.getenv("REPORTS_DIR", "reports"))
    data_dir: Path = Path(os.getenv("DATA_DIR", "data"))
    log_level: str = os.getenv("LOG_LEVEL", "INFO").upper()

    @property
    def has_gemini_key(self) -> bool:
        return bool(self.gemini_api_key)

settings = Settings()
