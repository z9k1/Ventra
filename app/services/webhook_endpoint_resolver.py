from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, Tuple

import httpx

from app.settings import settings

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 30.0
RESOLVER_TIMEOUT_SECONDS = 2.0

_cache_lock = threading.Lock()
_cache: Dict[str, Tuple["ResolvedWebhookEndpoint", float]] = {}


@dataclass(frozen=True)
class ResolvedWebhookEndpoint:
    env: str
    url: str
    secret: str
    endpoint_id: int
    updated_at: str | None
    fetched_at: datetime


def resolve_webhook_endpoint(env: str) -> ResolvedWebhookEndpoint | None:
    base_url = settings.ventrasim_base_url
    token = settings.ventra_internal_token
    if not base_url or not token:
        logger.debug("VentraSim resolver not configured (base_url=%s token=%s)", bool(base_url), bool(token))
        return None

    cached = _get_cached(env)
    if cached:
        return cached

    return _fetch_endpoint(env, base_url, token)


def _get_cached(env: str) -> ResolvedWebhookEndpoint | None:
    with _cache_lock:
        entry = _cache.get(env)
        if not entry:
            return None
        endpoint, timestamp = entry
        if time.monotonic() - timestamp >= CACHE_TTL_SECONDS:
            del _cache[env]
            return None
        logger.info("Using cached VentraSim endpoint for env %s (id=%s)", env, endpoint.endpoint_id)
        return endpoint


def _fetch_endpoint(env: str, base_url: str, token: str) -> ResolvedWebhookEndpoint | None:
    request_url = f"{base_url.rstrip('/')}/api/dev/webhook-endpoints/active?env={env}"
    headers = {"X-Internal-Token": token}
    try:
        response = httpx.get(request_url, headers=headers, timeout=RESOLVER_TIMEOUT_SECONDS)
        response.raise_for_status()
        payload = response.json()
    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        logger.warning(
            "VentraSim resolver returned HTTP %s for env %s",
            status,
            env,
        )
        return None
    except httpx.TimeoutException as exc:
        logger.warning("Timeout fetching VentraSim endpoint for env %s: %s", env, exc)
        return None
    except httpx.RequestError as exc:
        logger.warning("Failed to reach VentraSim resolver for env %s: %s", env, exc)
        return None
    except ValueError as exc:
        logger.warning("Invalid JSON from VentraSim resolver for env %s: %s", env, exc)
        return None

    try:
        endpoint_id = int(payload["id"])
        url_value = str(payload["url"])
        secret_value = str(payload["secret"])
        updated_at = payload.get("updatedAt")
    except (KeyError, TypeError, ValueError) as exc:
        logger.warning("Unexpected VentraSim resolver response for env %s: %s", env, exc)
        return None

    resolved = ResolvedWebhookEndpoint(
        env=env,
        url=url_value,
        secret=secret_value,
        endpoint_id=endpoint_id,
        updated_at=updated_at,
        fetched_at=datetime.now(timezone.utc),
    )
    with _cache_lock:
        _cache[env] = (resolved, time.monotonic())
    logger.info("Loaded VentraSim endpoint for env %s (id=%s)", env, resolved.endpoint_id)
    return resolved