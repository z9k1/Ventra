
def test_release_requires_paid_in_escrow(client):
    order_res = client.post("/orders", json={"amount_cents": 1000, "currency": "BRL"})
    order_id = order_res.json()["id"]

    release_res = client.post(f"/orders/{order_id}/release")
    assert release_res.status_code == 409


def test_refund_requires_paid_in_escrow(client):
    order_res = client.post("/orders", json={"amount_cents": 1000, "currency": "BRL"})
    order_id = order_res.json()["id"]

    refund_res = client.post(f"/orders/{order_id}/refund")
    assert refund_res.status_code == 409
