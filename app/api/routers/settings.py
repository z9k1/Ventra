from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.deps import require_api_key
from app.runtime_settings import set_api_key

router = APIRouter(prefix="/settings", tags=["settings"], dependencies=[Depends(require_api_key)])


class ApiKeyPayload(BaseModel):
    api_key: str


@router.post("/api-key")
def update_api_key(payload: ApiKeyPayload) -> dict:
    value = payload.api_key.strip()
    if not value:
        raise HTTPException(status_code=400, detail="api_key_required")
    set_api_key(value)
    return {"ok": True}
