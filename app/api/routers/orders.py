from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.api.deps import check_idempotency, db_session, require_api_key, store_idempotency
from app.domain.errors import DomainError
from app.domain.enums import ChargeStatus, OrderStatus
from app.services import orders_service

router = APIRouter(prefix="/orders", tags=["orders"], dependencies=[Depends(require_api_key)])


class OrderCreate(BaseModel):
    amount_cents: int = Field(gt=0)
    currency: str = Field(min_length=3, max_length=3, default="BRL")


class ChargeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: ChargeStatus
    expires_at: datetime
    pix_emv: str
    txid: str


class OrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: OrderStatus
    amount_cents: int
    currency: str
    created_at: datetime
    updated_at: datetime
    charge: ChargeResponse | None = None


def _serialize_order(order, charge=None) -> dict:
    payload = OrderResponse.model_validate(order).model_dump(mode="json")
    if charge:
        payload["charge"] = ChargeResponse.model_validate(charge).model_dump(mode="json")
    return payload


@router.post("", status_code=201)
def create_order(
    body: OrderCreate,
    request: Request,
    db: Session = Depends(db_session),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    endpoint = request.url.path
    existing = None
    request_hash_value = None
    if idempotency_key:
        try:
            existing, request_hash_value = check_idempotency(
                db,
                key=idempotency_key,
                endpoint=endpoint,
                payload=body.model_dump(),
            )
        except DomainError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
        if existing:
            return JSONResponse(content=existing.response_json, status_code=existing.status_code)

    try:
        with db.begin():
            order = orders_service.create_order(db, amount_cents=body.amount_cents, currency=body.currency)
            response_json = _serialize_order(order)
            if idempotency_key and request_hash_value:
                store_idempotency(
                    db,
                    key=idempotency_key,
                    endpoint=endpoint,
                    request_hash_value=request_hash_value,
                    response_json=response_json,
                    status_code=201,
                )
    except DomainError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    return JSONResponse(content=response_json, status_code=201)


@router.get("/{order_id}", response_model=OrderResponse)
def get_order(order_id: UUID, db: Session = Depends(db_session)):
    order, charge = orders_service.get_order_with_charge(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return _serialize_order(order, charge)
