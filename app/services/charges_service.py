from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.domain.enums import ChargeStatus, LedgerAccount, LedgerDirection, LedgerEntryType, OrderStatus
from app.domain.errors import InvalidStateError, NotFoundError
from app.domain.state_machine import ensure_charge_transition, ensure_order_transition
from app.repos import charge_repo, ledger_repo, order_repo
from app.services import webhooks_service
from app.settings import settings


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def create_pix_charge(db: Session, order_id, background_tasks=None):
    order = order_repo.get(db, order_id)
    if not order:
        raise NotFoundError("Order not found")
    if order.status != OrderStatus.AWAITING_PAYMENT.value:
        raise InvalidStateError("Order not awaiting payment")

    expires_at = _now_utc() + timedelta(minutes=settings.pix_charge_exp_minutes)
    pix_emv = f"EMV-SANDBOX-{uuid.uuid4().hex}"
    txid = uuid.uuid4().hex

    charge = charge_repo.create(
        db,
        order_id=order_id,
        status=ChargeStatus.PENDING.value,
        expires_at=expires_at,
        pix_emv=pix_emv,
        txid=txid,
    )

    webhooks_service.emit_event(
        db,
        "charge.created",
        {"order_id": str(order_id), "charge_id": str(charge.id)},
        background_tasks,
    )
    return charge


def simulate_paid(db: Session, charge_id, background_tasks=None):
    charge = charge_repo.get_for_update(db, charge_id)
    if not charge:
        raise NotFoundError("Charge not found")

    order = order_repo.get_for_update(db, charge.order_id)
    if not order:
        raise NotFoundError("Order not found")

    if charge.status != ChargeStatus.PENDING.value:
        raise InvalidStateError("Charge not pending")

    now = _now_utc()
    if now > charge.expires_at:
        ensure_charge_transition(ChargeStatus.PENDING, ChargeStatus.EXPIRED)
        charge.status = ChargeStatus.EXPIRED.value
        return order, charge, True

    if order.status != OrderStatus.AWAITING_PAYMENT.value:
        raise InvalidStateError("Order not awaiting payment")

    ensure_charge_transition(ChargeStatus.PENDING, ChargeStatus.PAID)
    ensure_order_transition(OrderStatus.AWAITING_PAYMENT, OrderStatus.PAID_IN_ESCROW)

    charge.status = ChargeStatus.PAID.value
    order.status = OrderStatus.PAID_IN_ESCROW.value

    ledger_repo.add_entry(
        db,
        order_id=order.id,
        entry_type=LedgerEntryType.PAYMENT_CONFIRMED.value,
        amount_cents=order.amount_cents,
        direction=LedgerDirection.DEBIT.value,
        account=LedgerAccount.CUSTOMER.value,
        meta={"charge_id": str(charge.id)},
    )
    ledger_repo.add_entry(
        db,
        order_id=order.id,
        entry_type=LedgerEntryType.ESCROW_HELD.value,
        amount_cents=order.amount_cents,
        direction=LedgerDirection.CREDIT.value,
        account=LedgerAccount.ESCROW.value,
        meta={"charge_id": str(charge.id)},
    )

    webhooks_service.emit_event(
        db,
        "charge.paid",
        {"order_id": str(order.id), "charge_id": str(charge.id)},
        background_tasks,
    )
    webhooks_service.emit_event(
        db,
        "order.paid_in_escrow",
        {"order_id": str(order.id)},
        background_tasks,
    )
    return order, charge, False


def cancel_charge(db: Session, charge_id):
    charge = charge_repo.get(db, charge_id)
    if not charge:
        raise NotFoundError("Charge not found")
    if charge.status != ChargeStatus.PENDING.value:
        raise InvalidStateError("Charge not pending")
    ensure_charge_transition(ChargeStatus.PENDING, ChargeStatus.CANCELED)
    charge.status = ChargeStatus.CANCELED.value
    return charge
