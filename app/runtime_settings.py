from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from app.settings import settings

RUNTIME_DIR = Path(".runtime")
API_KEY_FILE = RUNTIME_DIR / "api_key.json"


def _read_api_key_file() -> str | None:
    if not API_KEY_FILE.exists():
        return None
    try:
        data = json.loads(API_KEY_FILE.read_text(encoding="utf-8"))
    except Exception:
        return None
    value = data.get("api_key") if isinstance(data, dict) else None
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def get_api_key() -> str:
    runtime_key = _read_api_key_file()
    return runtime_key or settings.api_key


def set_api_key(value: str) -> None:
    clean = value.strip()
    if not clean:
        raise ValueError("api_key must not be empty")
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "api_key": clean,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    temp_path = API_KEY_FILE.with_suffix(".tmp")
    temp_path.write_text(json.dumps(payload, ensure_ascii=True), encoding="utf-8")
    temp_path.replace(API_KEY_FILE)
