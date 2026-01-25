from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.api.deps import db_session, require_api_key
from app.domain.enums import LedgerAccount, LedgerDirection
from app.repos import ledger_repo, order_repo

router = APIRouter(tags=["ledger"], dependencies=[Depends(require_api_key)])


class LedgerEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    order_id: UUID
    type: str
    amount_cents: int
    direction: LedgerDirection
    account: LedgerAccount
    created_at: datetime
    meta: dict | None = None


class BalanceResponse(BaseModel):
    available_balance_cents: int
    escrow_balance_cents: int
    total_balance_cents: int


@router.get("/orders/{order_id}/ledger", response_model=list[LedgerEntryResponse])
def list_ledger(order_id: UUID, db: Session = Depends(db_session)):
    order = order_repo.get(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    entries = ledger_repo.list_by_order(db, order_id)
    return [LedgerEntryResponse.model_validate(entry).model_dump(mode="json") for entry in entries]


@router.get("/balance", response_model=BalanceResponse)
def get_balance(db: Session = Depends(db_session)):
    """
    Calculates the balance based on ledger entries.

    Accounting rules:
    - Available Balance (available_balance_cents): Sum of all entries in the 'merchant' account.
      This represents funds that have been released from escrow and are available to the merchant.
    - Escrow Balance (escrow_balance_cents): Sum of all entries in the 'escrow' account.
      This represents funds that are paid but still held in custody.
    - Total Balance (total_balance_cents): Sum of available and escrow balances.
    """
    available = ledger_repo.get_balance_for_account(db, LedgerAccount.MERCHANT.value)
    escrow = ledger_repo.get_balance_for_account(db, LedgerAccount.ESCROW.value)
    return BalanceResponse(
        available_balance_cents=available,
        escrow_balance_cents=escrow,
        total_balance_cents=available + escrow,
    )
