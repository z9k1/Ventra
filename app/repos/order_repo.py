from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.order import Order


def create(db: Session, amount_cents: int, currency: str) -> Order:
    order = Order(amount_cents=amount_cents, currency=currency, status="CREATED")
    db.add(order)
    return order


def get(db: Session, order_id) -> Order | None:
    return db.get(Order, order_id)


def get_for_update(db: Session, order_id) -> Order | None:
    stmt = select(Order).where(Order.id == order_id).with_for_update()
    return db.execute(stmt).scalar_one_or_none()
