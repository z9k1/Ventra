from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.idempotency import IdempotencyKey


def get(db: Session, key: str, endpoint: str) -> IdempotencyKey | None:
    stmt = select(IdempotencyKey).where(
        IdempotencyKey.key == key,
        IdempotencyKey.endpoint == endpoint,
    )
    return db.execute(stmt).scalar_one_or_none()


def create(
    db: Session,
    key: str,
    endpoint: str,
    request_hash: str,
    response_json: dict,
    status_code: int,
) -> IdempotencyKey:
    record = IdempotencyKey(
        key=key,
        endpoint=endpoint,
        request_hash=request_hash,
        response_json=response_json,
        status_code=status_code,
    )
    db.add(record)
    return record
