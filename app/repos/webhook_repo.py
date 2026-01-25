from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.webhook import WebhookSubscription


def list_enabled(db: Session) -> list[WebhookSubscription]:
    stmt = select(WebhookSubscription).where(WebhookSubscription.is_enabled.is_(True))
    return list(db.execute(stmt).scalars().all())


def get_by_url(db: Session, url: str) -> WebhookSubscription | None:
    stmt = select(WebhookSubscription).where(WebhookSubscription.url == url)
    return db.execute(stmt).scalar_one_or_none()


def create(db: Session, url: str, secret: str, is_enabled: bool = True) -> WebhookSubscription:
    sub = WebhookSubscription(url=url, secret=secret, is_enabled=is_enabled)
    db.add(sub)
    return sub
