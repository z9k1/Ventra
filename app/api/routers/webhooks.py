from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import db_session, require_api_key
from app.services import webhooks_service

router = APIRouter(prefix="/webhooks", tags=["webhooks"], dependencies=[Depends(require_api_key)])


class WebhookTestRequest(BaseModel):
    event: str = "webhook.test"
    data: dict = Field(default_factory=dict)


@router.post("/test")
def send_test_webhook(body: WebhookTestRequest, background_tasks: BackgroundTasks, db: Session = Depends(db_session)):
    webhooks_service.emit_event(db, body.event, body.data, background_tasks)
    return {"status": "queued"}
