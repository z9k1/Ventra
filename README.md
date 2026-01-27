# Ventra + VentraSim

**Event-driven Pix escrow platform** with a full **merchant simulator** to validate real-world webhook integrations — inspired by Stripe, Adyen and Mercado Pago.

> This is **not a fake checkout** and **not a mock system**.
> Ventra exists to prove — technically — that a payment platform can be **integrated, stressed, broken and observed** like a real one.

## What this project demonstrates

This project focuses on **integration realism**, not UI polish or fake flows.

It demonstrates:

* Event-driven payment architecture
* Escrow state machines (custody → release)
* **Signed, idempotent webhooks**
* Delivery retries and latency tracking
* Failure simulation (offline / timeout)
* Clear separation between **platform** and **merchant**
* Observability of events and delivery attempts

All running in **sandbox**, but with **production-grade architectural decisions**.

---

## Architecture overview

```
Ventra (Escrow Platform)
        |
        |  Signed Webhooks (HMAC)
        v
VentraSim (Merchant Simulator)
```

* Ventra is the **source of truth**
* VentraSim behaves like a **real merchant integration**

---

## Components

### Ventra — Escrow Core

Payment / escrow platform.

Responsibilities:

* Create escrow orders
* Simulate Pix payments (sandbox)
* Maintain the **sovereign ledger**
* Emit domain events via webhook

**Tech stack**

* Python
* PostgreSQL

---

### VentraSim — Merchant Simulator

Official integration client for Ventra.

Responsibilities:

* Create sandbox orders in Ventra
* Receive signed webhooks
* Validate HMAC signatures
* Enforce idempotency by `event_id`
* Register **every delivery attempt**
* Simulate delivery failures
* Expose full event & retry timeline

**Tech stack**

* Next.js (App Router)
* Drizzle ORM
* PostgreSQL

> VentraSim represents how a **real merchant** would integrate with Ventra.

---

## Core design principles

### Events are never discarded

* Every webhook is persisted
* Invalid signatures are **stored, not dropped**
* Failures are treated as **first-class signals**

This enables:

* Realistic debugging
* Full audit trails
* Retry analysis

---

### Ledger sovereignty

VentraSim:

* ❌ does not calculate balances
* ❌ does not derive financial truth
* ❌ does not override states

Displayed states come from:

* received events
* or direct reads from Ventra

> Ventra’s ledger is always the final authority.

---

### Correct idempotency

* Each event has a unique `event_id`
* Duplicate events:

  * do **not** create new events
  * only generate new **delivery attempts**

This allows observing:

* automatic retries
* duplicated deliveries
* timing gaps between attempts

---

## Webhooks

### Receiver endpoint

```
POST /api/webhooks/ventra/:env
```

Environments:

* `local`
* `sandbox`
* `staging`

---

### Signature validation

* Header: `X-Signature`
* Algorithm: `HMAC-SHA256`
* Payload: **raw request body**

Rules:

* Constant-time comparison
* Events are persisted even if signature fails
* Invalid events are flagged as **SIG FAIL** in the UI

---

## Delivery failure simulation

VentraSim can simulate real network conditions:

| Mode    | Behavior                            |
| ------- | ----------------------------------- |
| normal  | Responds `200 OK`                   |
| offline | Immediate `503 Service Unavailable` |
| timeout | Delayed response until timeout      |

Each delivery attempt records:

* attempt number
* latency
* failure mode
* endpoint snapshot

This allows validating:

* retry behavior
* backoff strategies
* integration resilience

---

## Manual retry (Stripe-like)

VentraSim supports **manual webhook retries**:

* Re-delivers the original event payload
* Re-signs using the active endpoint secret
* Creates a new delivery attempt
* Preserves idempotency (no duplicated events)

Returned metadata includes:

* attempt number
* status code
* latency
* delivery ID

---

## User interface

### `/events`

Event timeline showing:

* event type (e.g. `charge.created`)
* `order_id`
* delivery badges:

  * `SIG OK / SIG FAIL`
  * `RETRY N`
  * `Δ +Xs` (delivery delay)

---

### Event drawer

Clicking an event opens a detailed view with:

* payload (JSON)
* signed headers
* delivery timeline with attempts
* manual retry action

Inspired directly by the **Stripe Dashboard**.

---

### `/orders`

* List of orders created in Ventra
* Status updates driven exclusively by webhooks

### `/orders/[orderId]`

* Order detail page
* State reflects Ventra’s ledger, not UI assumptions

---

## End-to-end flow (validated)

1. Create order in VentraSim
2. Ventra creates sandbox escrow
3. Payment and release simulated
4. Ventra emits webhook events
5. VentraSim receives and validates them
6. UI reflects the real order state

---

## Out of scope (by design)

This project intentionally does **not** include:

* ❌ Real Pix integration
* ❌ Marketplace features
* ❌ Financial dashboards
* ❌ Advanced analytics
* ❌ Multi-merchant SaaS setup

Those belong to a **product**, not a technical simulator.

---

## Project status

✔️ End-to-end flow validated
✔️ Manual retry implemented
✔️ Failure simulation working
✔️ Architecture ready to evolve

---

## Final note

Ventra + VentraSim exist to prove one thing:

> A payment platform is only real when someone can integrate it, break it, retry it — and understand exactly what happened.

This project focuses on that reality.

---
