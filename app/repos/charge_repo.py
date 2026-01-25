from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.charge import Charge


def create(db: Session, order_id, status: str, expires_at, pix_emv: str, txid: str) -> Charge:
    charge = Charge(
        order_id=order_id,
        status=status,
        expires_at=expires_at,
        pix_emv=pix_emv,
        txid=txid,
    )
    db.add(charge)
    return charge


def get(db: Session, charge_id) -> Charge | None:
    return db.get(Charge, charge_id)


def get_for_update(db: Session, charge_id) -> Charge | None:
    stmt = select(Charge).where(Charge.id == charge_id).with_for_update()
    return db.execute(stmt).scalar_one_or_none()


def get_for_order_latest(db: Session, order_id) -> Charge | None:
    stmt = select(Charge).where(Charge.order_id == order_id).order_by(Charge.created_at.desc())
    return db.execute(stmt).scalars().first()
