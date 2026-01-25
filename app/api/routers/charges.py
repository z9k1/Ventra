from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.api.deps import check_idempotency, db_session, require_api_key, store_idempotency
from app.domain.errors import DomainError
from app.domain.enums import ChargeStatus, OrderStatus
from app.services import charges_service
from app.settings import settings

router = APIRouter(tags=["charges"], dependencies=[Depends(require_api_key)])


class ChargeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    order_id: UUID
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


class PaidResponse(BaseModel):
    order: OrderResponse
    charge: ChargeResponse


def _serialize_charge(charge) -> dict:
    return ChargeResponse.model_validate(charge).model_dump(mode="json")


def _serialize_order(order) -> dict:
    return OrderResponse.model_validate(order).model_dump(mode="json")


@router.post("/orders/{order_id}/charges/pix", status_code=201)
def create_pix_charge(
    order_id: UUID,
    request: Request,
    background_tasks: BackgroundTasks,
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
                payload={},
            )
        except DomainError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
        if existing:
            return JSONResponse(content=existing.response_json, status_code=existing.status_code)

    try:
        with db.begin():
            charge = charges_service.create_pix_charge(db, order_id=order_id, background_tasks=background_tasks)
            response_json = _serialize_charge(charge)
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


@router.post("/charges/{charge_id}/simulate-paid", response_model=PaidResponse)
def simulate_paid(
    charge_id: UUID,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(db_session),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    if settings.env != "sandbox":
        raise HTTPException(status_code=404, detail="Not found")

    endpoint = request.url.path
    existing = None
    request_hash_value = None
    if idempotency_key:
        try:
            existing, request_hash_value = check_idempotency(
                db,
                key=idempotency_key,
                endpoint=endpoint,
                payload={},
            )
        except DomainError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
        if existing:
            return JSONResponse(content=existing.response_json, status_code=existing.status_code)

    try:
        with db.begin():
            order, charge, expired = charges_service.simulate_paid(
                db, charge_id=charge_id, background_tasks=background_tasks
            )
            if expired:
                response_json = {"detail": "Charge expired"}
                if idempotency_key and request_hash_value:
                    store_idempotency(
                        db,
                        key=idempotency_key,
                        endpoint=endpoint,
                        request_hash_value=request_hash_value,
                        response_json=response_json,
                        status_code=410,
                    )
                return JSONResponse(content=response_json, status_code=410)

            response_json = {
                "order": _serialize_order(order),
                "charge": _serialize_charge(charge),
            }
            if idempotency_key and request_hash_value:
                store_idempotency(
                    db,
                    key=idempotency_key,
                    endpoint=endpoint,
                    request_hash_value=request_hash_value,
                    response_json=response_json,
                    status_code=200,
                )
    except DomainError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    return response_json


@router.post("/charges/{charge_id}/cancel", response_model=ChargeResponse)
def cancel_charge(
    charge_id: UUID,
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
                payload={},
            )
        except DomainError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
        if existing:
            return JSONResponse(content=existing.response_json, status_code=existing.status_code)

    try:
        with db.begin():
            charge = charges_service.cancel_charge(db, charge_id=charge_id)
            response_json = _serialize_charge(charge)
            if idempotency_key and request_hash_value:
                store_idempotency(
                    db,
                    key=idempotency_key,
                    endpoint=endpoint,
                    request_hash_value=request_hash_value,
                    response_json=response_json,
                    status_code=200,
                )
    except DomainError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    return response_json
