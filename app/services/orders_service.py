from __future__ import annotations

from sqlalchemy.orm import Session

from app.domain.enums import OrderStatus
from app.domain.state_machine import ensure_order_transition
from app.repos import order_repo, charge_repo


def create_order(db: Session, amount_cents: int, currency: str):
    order = order_repo.create(db, amount_cents=amount_cents, currency=currency)
    ensure_order_transition(OrderStatus.CREATED, OrderStatus.AWAITING_PAYMENT)
    order.status = OrderStatus.AWAITING_PAYMENT.value
    return order


def get_order_with_charge(db: Session, order_id):
    order = order_repo.get(db, order_id)
    if not order:
        return None, None
    charge = charge_repo.get_for_order_latest(db, order_id)
    return order, charge
