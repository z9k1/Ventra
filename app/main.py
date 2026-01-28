from __future__ import annotations

from fastapi import FastAPI

from app.api.routers import charges, escrow, ledger, orders, settings, webhooks
from app.db import SessionLocal
from app.services import webhooks_service

app = FastAPI(title="Escrow Pix API", version="0.1.0")

app.include_router(orders.router)
app.include_router(charges.router)
app.include_router(escrow.router)
app.include_router(ledger.router)
app.include_router(webhooks.router)
app.include_router(settings.router)


@app.on_event("startup")
def ensure_webhook_subscription():
    db = SessionLocal()
    try:
        with db.begin():
            webhooks_service.ensure_default_subscription(db)
    finally:
        db.close()
