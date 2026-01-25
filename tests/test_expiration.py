from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select

from app.models.charge import Charge
from app.models.ledger import LedgerEntry


def test_charge_expiration_marks_expired(client, db_session):
    order_res = client.post("/orders", json={"amount_cents": 1000, "currency": "BRL"})
    order_id = order_res.json()["id"]

    charge_res = client.post(f"/orders/{order_id}/charges/pix")
    charge_id = charge_res.json()["id"]

    charge = db_session.get(Charge, UUID(charge_id))
    charge.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db_session.commit()

    paid_res = client.post(f"/charges/{charge_id}/simulate-paid")
    assert paid_res.status_code == 410

    refreshed = db_session.get(Charge, UUID(charge_id))
    assert refreshed.status == "EXPIRED"

    entries = db_session.execute(select(LedgerEntry)).scalars().all()
    assert len(entries) == 0
