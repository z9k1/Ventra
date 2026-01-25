from sqlalchemy import select

from app.models.ledger import LedgerEntry


def test_ledger_append_only_and_balance(client, db_session):
    order_res = client.post("/orders", json={"amount_cents": 1500, "currency": "BRL"})
    order_id = order_res.json()["id"]

    charge_res = client.post(f"/orders/{order_id}/charges/pix")
    charge_id = charge_res.json()["id"]

    paid_res = client.post(f"/charges/{charge_id}/simulate-paid")
    assert paid_res.status_code == 200

    release_res = client.post(f"/orders/{order_id}/release")
    assert release_res.status_code == 200

    entries = db_session.execute(select(LedgerEntry)).scalars().all()
    assert len(entries) == 4

    balance_res = client.get("/balance")
    assert balance_res.status_code == 200
    balance = balance_res.json()
    assert balance["available_balance_cents"] == 1500
    assert balance["escrow_balance_cents"] == 0
    assert balance["total_balance_cents"] == 1500

    ledger_res = client.get(f"/orders/{order_id}/ledger")
    assert ledger_res.status_code == 200
    assert len(ledger_res.json()) == 4
