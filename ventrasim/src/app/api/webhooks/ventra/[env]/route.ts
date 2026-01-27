import { createHash, createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

import {
  getEndpointConfig,
  getNextAttemptNumber,
  insertWebhookDelivery,
  insertWebhookEventIfNotExists,
  OrderEnv,
  upsertOrder
} from '@/db/queries'

const allowedEnvs = ['local', 'sandbox', 'staging'] as const
type Env = (typeof allowedEnvs)[number]

export const runtime = 'nodejs'

function normalizeSignature(value: string | null) {
  return (value ?? '').trim().replace(/^0x/i, '').toLowerCase()
}

function constantTimeEqualHex(aHex: string, bHex: string) {
  if (!aHex || !bHex) return false
  if (aHex.length !== bHex.length) return false
  const aBuf = Buffer.from(aHex, 'hex')
  const bBuf = Buffer.from(bHex, 'hex')
  return timingSafeEqual(aBuf, bBuf)
}

function parseEventTimestamp(value: unknown) {
  if (typeof value !== 'string' || !value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function extractOrderId(payload: any) {
  if (payload && typeof payload.order_id === 'string') return payload.order_id
  if (payload?.data && typeof payload.data.order_id === 'string') return payload.data.order_id
  return 'unknown'
}

function fallbackEventId(rawBody: Buffer) {
  return `missing-${createHash('sha256').update(rawBody).digest('hex')}`
}

const ORDER_STATUS_BY_EVENT: Record<string, string> = {
  'charge.created': 'AWAITING_PAYMENT',
  'payment.created': 'AWAITING_PAYMENT',
  'charge.paid': 'PAID',
  'payment.paid': 'PAID',
  'order.paid_in_escrow': 'IN_ESCROW',
  'escrow.funds_held': 'IN_ESCROW',
  'escrow.in_escrow': 'IN_ESCROW',
  'order.in_escrow': 'IN_ESCROW',
  'escrow.released': 'RELEASED',
  'order.released': 'RELEASED',
  'escrow.refunded': 'REFUNDED',
  'order.refunded': 'REFUNDED'
}

function deriveOrderStatusFromEvent(eventType: string) {
  return ORDER_STATUS_BY_EVENT[eventType.toLowerCase()] ?? null
}

function getPayloadData(payload: any) {
  if (payload && typeof payload.data === 'object' && payload.data !== null) {
    return payload.data
  }
  return payload
}

function pickString(payload: any, ...keys: string[]) {
  for (const key of keys) {
    if (payload && typeof payload[key] === 'string' && payload[key]) {
      return payload[key]
    }
  }
  return null
}

function pickNumber(payload: any, ...keys: string[]) {
  for (const key of keys) {
    if (payload && typeof payload[key] === 'number') {
      return payload[key]
    }
  }
  return null
}

function resolveEventType(payload: any) {
  if (typeof payload?.type === 'string' && payload.type) return payload.type
  if (typeof payload?.event === 'string' && payload.event) return payload.event
  if (typeof payload?.event?.type === 'string' && payload.event.type) return payload.event.type
  return 'unknown'
}

async function upsertOrderFromWebhook(payload: any, env: OrderEnv, eventType: string) {
  const orderId = extractOrderId(payload)
  if (!orderId || orderId === 'unknown') return

  const derivedStatus = deriveOrderStatusFromEvent(eventType)
  if (!derivedStatus) return

  const dataSection = getPayloadData(payload)
  const amount = pickNumber(dataSection, 'amount_cents', 'amount')
  const currency = pickString(dataSection, 'currency') ?? undefined
  const chargeId = pickString(dataSection, 'charge_id', 'chargeId') ?? undefined
  const txid = pickString(dataSection, 'txid', 'txId') ?? undefined

  await upsertOrder({
    env,
    orderId,
    status: derivedStatus,
    amount: amount ?? null,
    currency,
    chargeId,
    txid
  })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ env: string }> }) {
  const start = Date.now()
  const { env } = await params
  const resolvedEnv = env as Env
  if (!allowedEnvs.includes(resolvedEnv)) {
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  const config = await getEndpointConfig(resolvedEnv)
  const secret = config?.secret ?? null
  const mode = config?.deliveryMode ?? 'normal'
  const timeoutMs = config?.timeoutMs ?? 15000

  const rawArray = await request.arrayBuffer()
  const rawBody = Buffer.from(rawArray)
  const rawText = rawBody.toString('utf-8')

  const headersJson: Record<string, string> = {}
  for (const [key, value] of request.headers.entries()) {
    headersJson[key] = value
  }

  let payload: any = {}
  let parseError: string | null = null
  try {
    payload = rawText ? JSON.parse(rawText) : {}
  } catch (err) {
    parseError = err instanceof Error ? err.message : 'invalid_json'
    payload = {}
  }

  const eventId = typeof payload?.id === 'string' && payload.id ? payload.id : fallbackEventId(rawBody)
  const eventType = resolveEventType(payload)
  const orderId = extractOrderId(payload)
  const eventTimestamp = parseEventTimestamp(payload?.created_at)
  const receivedAt = new Date()
  const deltaMs = eventTimestamp ? receivedAt.getTime() - eventTimestamp.getTime() : null

  const headerSignature = normalizeSignature(request.headers.get('x-signature'))
  const calculatedSignature = secret
    ? createHmac('sha256', secret).update(rawBody).digest('hex')
    : ''
  const signatureOk = secret ? constantTimeEqualHex(calculatedSignature, headerSignature) : false

  const payloadJson = parseError ? { raw: rawText, parse_error: parseError } : payload

  try {
    await insertWebhookEventIfNotExists({
      eventId,
      env: resolvedEnv,
      eventType,
      orderId,
      signatureOk,
      eventTimestamp,
      deltaMs,
      payloadJson,
      headersJson
    })

    await upsertOrderFromWebhook(payload, resolvedEnv as OrderEnv, eventType)

    const attemptNumber = await getNextAttemptNumber(eventId)

    if (mode === 'offline') {
      const latencyMs = Date.now() - start
      await insertWebhookDelivery({
        eventId,
        attemptNumber,
        status: '503',
        modeUsed: 'offline',
        latencyMs,
        endpointId: config?.id ?? null,
        endpointUrlSnapshot: config?.url ?? null
      })
      return NextResponse.json({ ok: false, simulated: 'offline' }, { status: 503 })
    }

    if (mode === 'timeout') {
      await new Promise((resolve) => setTimeout(resolve, timeoutMs))
      const latencyMs = Date.now() - start
      await insertWebhookDelivery({
        eventId,
        attemptNumber,
        status: '200',
        modeUsed: 'timeout',
        latencyMs,
        endpointId: config?.id ?? null,
        endpointUrlSnapshot: config?.url ?? null
      })
      return NextResponse.json({ ok: true, simulated: 'timeout' }, { status: 200 })
    }

    // Normal mode
    const latencyMs = Date.now() - start
    await insertWebhookDelivery({
      eventId,
      attemptNumber,
      status: '200',
      modeUsed: 'normal',
      latencyMs,
      endpointId: config?.id ?? null,
      endpointUrlSnapshot: config?.url ?? null
    })
    console.log('[ventrasim] webhook stored', {
      env: resolvedEnv,
      eventId,
      attemptNumber,
      signatureOk,
      mode
    })
  } catch (error) {
    console.error('[ventrasim] webhook store failed', error)
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
