from __future__ import annotations

from dataclasses import dataclass
import hashlib
import hmac
import json
import logging
import uuid
from datetime import datetime, timezone

import httpx
from sqlalchemy.orm import Session

from app.repos import webhook_repo
from app.services.webhook_endpoint_resolver import ResolvedWebhookEndpoint, resolve_webhook_endpoint
from app.settings import settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class WebhookTarget:
    url: str
    secret: str
    label: str
    endpoint_id: int | None = None


_warned_missing_resolver_config = False


def _warn_missing_resolver_config_once() -> None:
    global _warned_missing_resolver_config
    if _warned_missing_resolver_config:
        return
    logger.warning(
        "VENTRASIM_BASE_URL or VENTRA_INTERNAL_TOKEN missing; falling back to WEBHOOK_URL/SECRET"
    )
    _warned_missing_resolver_config = True


def _canonical_payload(payload: dict) -> bytes:
    return json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")


def _signature(secret: str, payload: bytes) -> str:
    return hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()


def send_webhook(
    url: str,
    secret: str,
    payload: dict,
    *,
    endpoint_id: int | None = None,
    label: str | None = None,
) -> None:
    payload_bytes = _canonical_payload(payload)
    signature = _signature(secret, payload_bytes)
    headers = {"X-Signature": signature, "Content-Type": "application/json"}
    event_name = payload.get("event")
    logger.info(
        "sending webhook %s to %s (source=%s endpoint_id=%s)",
        event_name,
        url,
        label or "unspecified",
        endpoint_id,
    )
    try:
        with httpx.Client(timeout=5) as client:
            response = client.post(url, content=payload_bytes, headers=headers)
            response.raise_for_status()
    except httpx.HTTPError as exc:
        logger.warning("webhook %s -> %s failed: %s", event_name, url, exc)


def emit_event(db: Session, event: str, data: dict, background_tasks=None) -> None:
    subscriptions = webhook_repo.list_enabled(db)
    resolved_endpoint: ResolvedWebhookEndpoint | None = resolve_webhook_endpoint(settings.env)
    fallback_url = settings.webhook_url
    fallback_secret = settings.webhook_secret

    targets: list[WebhookTarget] = []

    if resolved_endpoint:
        targets.append(
            WebhookTarget(
                url=resolved_endpoint.url,
                secret=resolved_endpoint.secret,
                label="ventrasim_resolver",
                endpoint_id=resolved_endpoint.endpoint_id,
            )
        )
    elif fallback_url and fallback_secret:
        if not settings.ventrasim_base_url or not settings.ventra_internal_token:
            _warn_missing_resolver_config_once()
        else:
            logger.warning(
                "VentraSim resolver failed for env %s; using WEBHOOK_URL/SECRET as fallback",
                settings.env,
            )
        targets.append(
            WebhookTarget(
                url=fallback_url,
                secret=fallback_secret,
                label="env_fallback",
            )
        )

    for subscription in subscriptions:
        if fallback_url and subscription.url == fallback_url:
            continue
        targets.append(
            WebhookTarget(
                url=subscription.url,
                secret=subscription.secret,
                label="db_subscription",
            )
        )

    if not targets:
        logger.debug("No webhook targets configured for event %s", event)
        return

    payload = {
        "id": str(uuid.uuid4()),
        "event": event,
        "data": data,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    for target in targets:
        if background_tasks is None:
            send_webhook(
                target.url,
                target.secret,
                payload,
                endpoint_id=target.endpoint_id,
                label=target.label,
            )
        else:
            background_tasks.add_task(
                send_webhook,
                target.url,
                target.secret,
                payload,
                endpoint_id=target.endpoint_id,
                label=target.label,
            )


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
