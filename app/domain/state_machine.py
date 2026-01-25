from __future__ import annotations

from app.domain.enums import ChargeStatus, OrderStatus
from app.domain.errors import InvalidStateError


ORDER_TRANSITIONS = {
    OrderStatus.CREATED: {OrderStatus.AWAITING_PAYMENT},
    OrderStatus.AWAITING_PAYMENT: {OrderStatus.PAID_IN_ESCROW},
    OrderStatus.PAID_IN_ESCROW: {
        OrderStatus.RELEASED,
        OrderStatus.REFUNDED,
        OrderStatus.DISPUTED,
    },
    OrderStatus.DISPUTED: {OrderStatus.RESOLVED},
}

CHARGE_TRANSITIONS = {
    ChargeStatus.PENDING: {ChargeStatus.PAID, ChargeStatus.EXPIRED, ChargeStatus.CANCELED},
}


def ensure_order_transition(current: OrderStatus, new: OrderStatus) -> None:
    allowed = ORDER_TRANSITIONS.get(current, set())
    if new not in allowed:
        raise InvalidStateError(f"Invalid order transition {current} -> {new}")


def ensure_charge_transition(current: ChargeStatus, new: ChargeStatus) -> None:
    allowed = CHARGE_TRANSITIONS.get(current, set())
    if new not in allowed:
        raise InvalidStateError(f"Invalid charge transition {current} -> {new}")
