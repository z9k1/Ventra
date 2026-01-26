import { createHash, createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

import {
  getActiveEndpointSecret,
  getNextAttemptNumber,
  insertWebhookDelivery,
  insertWebhookEventIfNotExists
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

export async function POST(request: NextRequest, context: { params: { env: string } }) {
  const env = context.params.env as Env
  if (!allowedEnvs.includes(env)) {
    return NextResponse.json({ ok: true }, { status: 200 })
  }

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
  const eventType = typeof payload?.type === 'string' && payload.type ? payload.type : 'unknown'
  const orderId = extractOrderId(payload)
  const eventTimestamp = parseEventTimestamp(payload?.created_at)
  const receivedAt = new Date()
  const deltaMs = eventTimestamp ? receivedAt.getTime() - eventTimestamp.getTime() : null

  const secret = await getActiveEndpointSecret(env)
  const headerSignature = normalizeSignature(request.headers.get('x-signature'))
  const calculatedSignature = secret
    ? createHmac('sha256', secret).update(rawBody).digest('hex')
    : ''
  const signatureOk = secret ? constantTimeEqualHex(calculatedSignature, headerSignature) : false

  const payloadJson = parseError ? { raw: rawText, parse_error: parseError } : payload

  await insertWebhookEventIfNotExists({
    eventId,
    env,
    eventType,
    orderId,
    signatureOk,
    eventTimestamp,
    deltaMs,
    payloadJson,
    headersJson
  })

  const attemptNumber = await getNextAttemptNumber(eventId)
  await insertWebhookDelivery({
    eventId,
    attemptNumber,
    status: '200'
  })

  return NextResponse.json({ ok: true }, { status: 200 })
}
