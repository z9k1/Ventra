from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.api.deps import check_idempotency, db_session, require_api_key, store_idempotency
from app.domain.errors import DomainError
from app.domain.enums import OrderStatus
from app.services import escrow_service

router = APIRouter(prefix="/orders", tags=["escrow"], dependencies=[Depends(require_api_key)])


class OrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: OrderStatus
    amount_cents: int
    currency: str
    created_at: datetime
    updated_at: datetime


def _serialize_order(order) -> dict:
    return OrderResponse.model_validate(order).model_dump(mode="json")


@router.post("/{order_id}/release", response_model=OrderResponse)
def release_order(
    order_id: UUID,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(db_session),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    endpoint = request.url.path
    try:
        with db.begin():
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

            order = escrow_service.release_order(db, order_id=order_id, background_tasks=background_tasks)
            response_json = _serialize_order(order)
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


@router.post("/{order_id}/refund", response_model=OrderResponse)
def refund_order(
    order_id: UUID,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(db_session),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    endpoint = request.url.path
    try:
        with db.begin():
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

            order = escrow_service.refund_order(db, order_id=order_id, background_tasks=background_tasks)
            response_json = _serialize_order(order)
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
