from sqlalchemy import select

from app.models.order import Order


def test_idempotency_same_body(client, db_session):
    key = "idem-1"
    body = {"amount_cents": 1000, "currency": "BRL"}

    first = client.post("/orders", json=body, headers={"Idempotency-Key": key})
    second = client.post("/orders", json=body, headers={"Idempotency-Key": key})

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json() == second.json()

    orders = db_session.execute(select(Order)).scalars().all()
    assert len(orders) == 1


def test_idempotency_conflict(client):
    key = "idem-2"
    body = {"amount_cents": 1000, "currency": "BRL"}
    other = {"amount_cents": 2000, "currency": "BRL"}

    first = client.post("/orders", json=body, headers={"Idempotency-Key": key})
    second = client.post("/orders", json=other, headers={"Idempotency-Key": key})

    assert first.status_code == 201
    assert second.status_code == 409
