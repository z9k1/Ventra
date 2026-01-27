import { NextRequest, NextResponse } from 'next/server'

import { deliverToEndpoint } from '@/lib/webhooks/delivery'
import {
  getEndpointConfig,
  getNextAttemptNumber,
  getWebhookEventByEventId,
  insertWebhookDelivery
} from '@/db/queries'

const allowedEnvs = ['local', 'sandbox', 'staging'] as const
type Env = (typeof allowedEnvs)[number]

type RetryBody = {
  env?: unknown
  eventId?: unknown
  event_id?: unknown
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

function buildRawPayload(payloadJson: unknown) {
  if (payloadJson && typeof payloadJson === 'object') {
    const candidate = payloadJson as Record<string, unknown>
    const rawValue = candidate.raw
    if (typeof rawValue === 'string' && rawValue) {
      return rawValue
    }
  }

  try {
    return JSON.stringify(payloadJson ?? {})
  } catch {
    return '{}'
  }
}

export async function POST(request: NextRequest) {
  let body: RetryBody
  try {
    body = (await request.json()) as RetryBody
  } catch {
    return badRequest('invalid_json')
  }

  const env = typeof body.env === 'string' ? body.env.trim() : ''
  const incomingEventId =
    (typeof body.eventId === 'string' && body.eventId.trim()) ||
    (typeof body.event_id === 'string' && body.event_id.trim()) ||
    ''

  if (!env) {
    return badRequest('env_required')
  }

  const normalizedEnv = env as Env
  if (!allowedEnvs.includes(normalizedEnv)) {
    return badRequest('invalid_env')
  }

  if (!incomingEventId) {
    return badRequest('event_id_required')
  }

  const webhookEvent = await getWebhookEventByEventId(incomingEventId)
  if (!webhookEvent || webhookEvent.env !== normalizedEnv) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const endpoint = await getEndpointConfig(normalizedEnv)
  if (!endpoint || !endpoint.url) {
    return NextResponse.json({ error: 'missing_active_endpoint' }, { status: 409 })
  }

  const rawBody = buildRawPayload(webhookEvent.payloadJson)
  const attemptNumber = await getNextAttemptNumber(webhookEvent.eventId)
  const start = Date.now()
  const mode = endpoint.deliveryMode ?? 'normal'
  const timeoutMs = endpoint.timeoutMs ?? 15000

  console.log('[ventrasim] webhook retry start', {
    env: normalizedEnv,
    eventId: webhookEvent.eventId,
    endpointId: endpoint.id,
    attemptNumber
  })

  if (mode === 'offline') {
    const latencyMs = Date.now() - start
    const inserted = await insertWebhookDelivery({
      eventId: webhookEvent.eventId,
      attemptNumber,
      status: '503',
      modeUsed: 'offline',
      latencyMs,
      endpointId: endpoint.id ?? null,
      endpointUrlSnapshot: endpoint.url,
      errorMessage: 'simulated_offline'
    })

    console.log('[ventrasim] webhook retry offline', {
      env: normalizedEnv,
      eventId: webhookEvent.eventId,
      endpointId: endpoint.id,
      attemptNumber,
      latencyMs
    })

    return NextResponse.json(
      {
        ok: false,
        attempt_number: attemptNumber,
        status_code: 503,
        latency_ms: latencyMs,
        delivery_id: inserted?.id ?? null
      },
      { status: 200 }
    )
  }

  if (mode === 'timeout') {
    await new Promise((resolve) => setTimeout(resolve, timeoutMs))
    const latencyMs = Date.now() - start
    const inserted = await insertWebhookDelivery({
      eventId: webhookEvent.eventId,
      attemptNumber,
      status: '200',
      modeUsed: 'timeout',
      latencyMs,
      endpointId: endpoint.id ?? null,
      endpointUrlSnapshot: endpoint.url
    })

    console.log('[ventrasim] webhook retry timeout', {
      env: normalizedEnv,
      eventId: webhookEvent.eventId,
      endpointId: endpoint.id,
      attemptNumber,
      latencyMs
    })

    return NextResponse.json(
      {
        ok: true,
        attempt_number: attemptNumber,
        status_code: 200,
        latency_ms: latencyMs,
        delivery_id: inserted?.id ?? null
      },
      { status: 200 }
    )
  }

  const deliveryResult = await deliverToEndpoint({
    endpoint: { id: endpoint.id ?? null, url: endpoint.url, secret: endpoint.secret ?? null },
    env: normalizedEnv,
    eventId: webhookEvent.eventId,
    rawBody
  })

  const statusCode = deliveryResult.statusCode
  const latencyMs = deliveryResult.latencyMs
  const inserted = await insertWebhookDelivery({
    eventId: webhookEvent.eventId,
    attemptNumber,
    status: statusCode !== null ? String(statusCode) : '0',
    modeUsed: 'normal',
    latencyMs,
    endpointId: endpoint.id ?? null,
    endpointUrlSnapshot: endpoint.url,
    errorMessage: deliveryResult.errorMessage
  })

  const ok = !deliveryResult.errorMessage && typeof statusCode === 'number' ? statusCode < 400 : false
  console.log('[ventrasim] webhook retry result', {
    env: normalizedEnv,
    eventId: webhookEvent.eventId,
    endpointId: endpoint.id,
    attemptNumber,
    statusCode,
    errorMessage: deliveryResult.errorMessage,
    latencyMs,
    mode
  })

  return NextResponse.json(
    {
      ok,
      attempt_number: attemptNumber,
      status_code: statusCode,
      latency_ms: latencyMs,
      delivery_id: inserted?.id ?? null
    },
    { status: 200 }
  )
}
