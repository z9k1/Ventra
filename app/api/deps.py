from __future__ import annotations

import hashlib
import json

from fastapi import Header, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.domain.errors import IdempotencyConflictError
from app.repos import idempotency_repo
from app.runtime_settings import get_api_key


def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    if not x_api_key or x_api_key != get_api_key():
        raise HTTPException(status_code=401, detail="Unauthorized")


def db_session() -> Session:
    yield from get_db()


def request_hash(payload: dict | None) -> str:
    canonical = json.dumps(payload or {}, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def check_idempotency(db: Session, key: str, endpoint: str, payload: dict | None):
    hashed = request_hash(payload)
    existing = idempotency_repo.get(db, key=key, endpoint=endpoint)
    if not existing:
        return None, hashed
    if existing.request_hash != hashed:
        raise IdempotencyConflictError("Idempotency key reused with different payload")
    return existing, hashed


def store_idempotency(
    db: Session,
    key: str,
    endpoint: str,
    request_hash_value: str,
    response_json: dict,
    status_code: int,
):
    idempotency_repo.create(
        db,
        key=key,
        endpoint=endpoint,
        request_hash=request_hash_value,
        response_json=response_json,
        status_code=status_code,
    )
