from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    env: str = "sandbox"
    database_url: str
    api_key: str
    pix_charge_exp_minutes: int = 15
    webhook_url: str | None = None
    webhook_secret: str | None = None
    ventrasim_base_url: str | None = None
    ventra_internal_token: str | None = None

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
