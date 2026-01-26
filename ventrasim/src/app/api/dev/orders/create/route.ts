import { NextRequest, NextResponse } from 'next/server'

import { createEscrow } from '@/lib/ventraClient'
import { OrderEnv, upsertOrder } from '@/db/queries'

const DEFAULT_ORDER_ENV: OrderEnv = 'sandbox'

function parseAmount(value: unknown): number | null {
  if (typeof value === 'number') {
    return value
  }
  if (typeof value === 'string') {
    const normalized = value.replace(',', '.').trim()
    if (!normalized) {
      return null
    }
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export async function POST(request: NextRequest) {
  let body: { amount?: unknown } = {}
  try {
    body = await request.json()
  } catch (error) {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const amount = parseAmount(body.amount)
  if (amount === null || amount <= 0) {
    return NextResponse.json({ error: 'invalid_amount' }, { status: 400 })
  }

  try {
    const payload = await createEscrow({ amount_cents: Math.round(amount * 100) })
    await upsertOrder({
      env: DEFAULT_ORDER_ENV,
      orderId: payload.order.id,
      amount: payload.order.amount_cents,
      currency: payload.order.currency,
      status: payload.order.status,
      chargeId: payload.charge.id,
      txid: payload.charge.txid
    })
    return NextResponse.json(payload, { status: 201 })
  } catch (error) {
    console.error('[ventrasim] failed to create escrow', error)
    const message = error instanceof Error ? error.message : 'unexpected_error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
