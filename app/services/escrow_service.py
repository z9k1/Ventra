from __future__ import annotations

from sqlalchemy.orm import Session

from app.domain.enums import LedgerAccount, LedgerDirection, LedgerEntryType, OrderStatus
from app.domain.errors import InvalidStateError, NotFoundError
from app.domain.state_machine import ensure_order_transition
from app.repos import ledger_repo, order_repo
from app.services import webhooks_service


def release_order(db: Session, order_id, background_tasks=None):
    order = order_repo.get_for_update(db, order_id)
    if not order:
        raise NotFoundError("Order not found")
    if order.status == OrderStatus.DISPUTED.value:
        raise InvalidStateError("Order disputed")
    if order.status != OrderStatus.PAID_IN_ESCROW.value:
        raise InvalidStateError("Order not paid in escrow")

    ensure_order_transition(OrderStatus.PAID_IN_ESCROW, OrderStatus.RELEASED)
    order.status = OrderStatus.RELEASED.value

    ledger_repo.add_entry(
        db,
        order_id=order.id,
        entry_type=LedgerEntryType.RELEASED_TO_MERCHANT.value,
        amount_cents=order.amount_cents,
        direction=LedgerDirection.DEBIT.value,
        account=LedgerAccount.ESCROW.value,
        meta={},
    )
    ledger_repo.add_entry(
        db,
        order_id=order.id,
        entry_type=LedgerEntryType.RELEASED_TO_MERCHANT.value,
        amount_cents=order.amount_cents,
        direction=LedgerDirection.CREDIT.value,
        account=LedgerAccount.MERCHANT.value,
        meta={},
    )

    webhooks_service.emit_event(
        db,
        "order.released",
        {"order_id": str(order.id)},
        background_tasks,
    )
    return order


def refund_order(db: Session, order_id, background_tasks=None):
    order = order_repo.get_for_update(db, order_id)
    if not order:
        raise NotFoundError("Order not found")
    if order.status != OrderStatus.PAID_IN_ESCROW.value:
        raise InvalidStateError("Order not paid in escrow")

    ensure_order_transition(OrderStatus.PAID_IN_ESCROW, OrderStatus.REFUNDED)
    order.status = OrderStatus.REFUNDED.value

    ledger_repo.add_entry(
        db,
        order_id=order.id,
        entry_type=LedgerEntryType.REFUNDED_TO_CUSTOMER.value,
        amount_cents=order.amount_cents,
        direction=LedgerDirection.DEBIT.value,
        account=LedgerAccount.ESCROW.value,
        meta={},
    )
    ledger_repo.add_entry(
        db,
        order_id=order.id,
        entry_type=LedgerEntryType.REFUNDED_TO_CUSTOMER.value,
        amount_cents=order.amount_cents,
        direction=LedgerDirection.CREDIT.value,
        account=LedgerAccount.CUSTOMER.value,
        meta={},
    )

    webhooks_service.emit_event(
        db,
        "order.refunded",
        {"order_id": str(order.id)},
        background_tasks,
    )
    return order
