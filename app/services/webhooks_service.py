from __future__ import annotations

import hashlib
import hmac
import json
import logging
import uuid
from datetime import datetime, timezone

import httpx
from sqlalchemy.orm import Session

from app.repos import webhook_repo
from app.settings import settings

logger = logging.getLogger(__name__)


def _canonical_payload(payload: dict) -> bytes:
    return json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")


def _signature(secret: str, payload: bytes) -> str:
    return hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()


def send_webhook(url: str, secret: str, payload: dict) -> None:
    payload_bytes = _canonical_payload(payload)
    signature = _signature(secret, payload_bytes)
    headers = {"X-Signature": signature, "Content-Type": "application/json"}
    event_name = payload.get("event")
    logger.info("sending webhook %s to %s", event_name, url)
    try:
        with httpx.Client(timeout=5) as client:
            response = client.post(url, content=payload_bytes, headers=headers)
            response.raise_for_status()
    except httpx.HTTPError as exc:
        logger.warning("webhook %s -> %s failed: %s", event_name, url, exc)


def emit_event(db: Session, event: str, data: dict, background_tasks=None) -> None:
    subscriptions = webhook_repo.list_enabled(db)
    if not subscriptions:
        return

    payload = {
        "id": str(uuid.uuid4()),
        "event": event,
        "data": data,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    for sub in subscriptions:
        if background_tasks is None:
            send_webhook(sub.url, sub.secret, payload)
        else:
            background_tasks.add_task(send_webhook, sub.url, sub.secret, payload)


def ensure_default_subscription(db: Session) -> None:
    if not settings.webhook_url or not settings.webhook_secret:
        return
    existing = webhook_repo.get_by_url(db, settings.webhook_url)
    if existing:
        if not existing.is_enabled:
            existing.is_enabled = True
        existing.secret = settings.webhook_secret
        return
    webhook_repo.create(db, url=settings.webhook_url, secret=settings.webhook_secret)
