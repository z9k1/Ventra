from __future__ import annotations

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.domain.enums import LedgerDirection
from app.models.ledger import LedgerEntry


def add_entry(
    db: Session,
    order_id,
    entry_type: str,
    amount_cents: int,
    direction: str,
    account: str,
    meta: dict | None = None,
) -> LedgerEntry:
    entry = LedgerEntry(
        order_id=order_id,
        type=entry_type,
        amount_cents=amount_cents,
        direction=direction,
        account=account,
        meta=meta or {},
    )
    db.add(entry)
    return entry


def list_by_order(db: Session, order_id) -> list[LedgerEntry]:
    stmt = select(LedgerEntry).where(LedgerEntry.order_id == order_id).order_by(LedgerEntry.created_at.asc())
    return list(db.execute(stmt).scalars().all())


def get_balance_for_account(db: Session, account: str) -> int:
    signed_amount = case(
        (LedgerEntry.direction == LedgerDirection.CREDIT.value, LedgerEntry.amount_cents),
        else_=-LedgerEntry.amount_cents,
    )
    stmt = select(func.coalesce(func.sum(signed_amount), 0)).where(LedgerEntry.account == account)
    return int(db.execute(stmt).scalar_one())
