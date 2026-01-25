import os

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("API_KEY", "test-key")
os.environ.setdefault("ENV", "sandbox")

import pytest
from fastapi.testclient import TestClient

from app.api import deps
from app.db import Base, SessionLocal, engine
from app.main import app


@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


def override_db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[deps.db_session] = override_db_session


@pytest.fixture()
def client():
    with TestClient(app) as client:
        client.headers.update({"X-API-KEY": "test-key"})
        yield client


@pytest.fixture()
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
