import { and, desc, eq, sql } from 'drizzle-orm'

import { db } from './index'
import { ventraSimOrders, webhookDeliveries, webhookEndpoints, webhookEvents } from './schema'

export async function getEndpointConfig(env: 'local' | 'sandbox' | 'staging') {
  const rows = await db
    .select({
      id: webhookEndpoints.id,
      url: webhookEndpoints.url,
      secret: webhookEndpoints.secret,
      deliveryMode: webhookEndpoints.deliveryMode,
      timeoutMs: webhookEndpoints.timeoutMs
    })
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.env, env), eq(webhookEndpoints.isActive, true)))
    .limit(1)
  return rows[0] ?? null
}

export async function updateEndpointMode(args: {
  env: 'local' | 'sandbox' | 'staging'
  deliveryMode: string
  timeoutMs?: number
}) {
  await db
    .update(webhookEndpoints)
    .set({
      deliveryMode: args.deliveryMode,
      timeoutMs: args.timeoutMs,
      updatedAt: new Date()
    })
    .where(eq(webhookEndpoints.env, args.env))
}

export async function getActiveEndpointSecret(env: 'local' | 'sandbox' | 'staging') {
  const config = await getEndpointConfig(env)
  return config?.secret ?? null
}

export async function insertWebhookEventIfNotExists(args: {
  eventId: string
  env: 'local' | 'sandbox' | 'staging'
  eventType: string
  orderId: string
  signatureOk: boolean
  eventTimestamp: Date | null
  deltaMs: number | null
  payloadJson: unknown
  headersJson: Record<string, string>
}) {
  await db
    .insert(webhookEvents)
    .values({
      eventId: args.eventId,
      env: args.env,
      eventType: args.eventType,
      orderId: args.orderId,
      signatureOk: args.signatureOk,
      eventTimestamp: args.eventTimestamp ?? undefined,
      deltaMs: args.deltaMs ?? undefined,
      payloadJson: args.payloadJson,
      headersJson: args.headersJson
    })
    .onConflictDoNothing({ target: webhookEvents.eventId })
}

export async function getNextAttemptNumber(eventId: string) {
  const rows = await db
    .select({
      maxAttempt: sql<number | null>`max(${webhookDeliveries.attemptNumber})`
    })
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.eventId, eventId))
  const current = rows[0]?.maxAttempt ?? 0
  return current + 1
}

export async function insertWebhookDelivery(args: {
  eventId: string
  attemptNumber: number
  status: string
  errorMessage?: string | null
  modeUsed?: string | null
  latencyMs?: number | null
  endpointId?: number | null
  endpointUrlSnapshot?: string | null
}) {
  await db.insert(webhookDeliveries).values({
    eventId: args.eventId,
    attemptNumber: args.attemptNumber,
    status: args.status,
    errorMessage: args.errorMessage ?? null,
    modeUsed: args.modeUsed ?? null,
    latencyMs: args.latencyMs ?? null,
    endpointId: args.endpointId ?? null,
    endpointUrlSnapshot: args.endpointUrlSnapshot ?? null
  })
}

export async function getWebhookEventByEventId(eventId: string) {
  const rows = await db
    .select({
      id: webhookEvents.id,
      eventId: webhookEvents.eventId,
      env: webhookEvents.env,
      eventType: webhookEvents.eventType,
      orderId: webhookEvents.orderId,
      signatureOk: webhookEvents.signatureOk,
      eventTimestamp: webhookEvents.eventTimestamp,
      receivedAt: webhookEvents.receivedAt,
      deltaMs: webhookEvents.deltaMs,
      payloadJson: webhookEvents.payloadJson,
      headersJson: webhookEvents.headersJson
    })
    .from(webhookEvents)
    .where(eq(webhookEvents.eventId, eventId))
    .limit(1)
  return rows[0] ?? null
}

export async function listDeliveriesByEventId(eventId: string) {
  return db
    .select({
      id: webhookDeliveries.id,
      eventId: webhookDeliveries.eventId,
      attemptNumber: webhookDeliveries.attemptNumber,
      status: webhookDeliveries.status,
      errorMessage: webhookDeliveries.errorMessage,
      modeUsed: webhookDeliveries.modeUsed,
      latencyMs: webhookDeliveries.latencyMs,
      endpointId: webhookDeliveries.endpointId,
      endpointUrlSnapshot: webhookDeliveries.endpointUrlSnapshot,
      receivedAt: webhookDeliveries.receivedAt
    })
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.eventId, eventId))
    .orderBy(webhookDeliveries.attemptNumber)
}

export type OrderEnv = 'local' | 'sandbox' | 'staging'

type UpsertOrderArgs = {
  env: OrderEnv
  orderId: string
  status: string
  amount?: number | null
  currency?: string | null
  chargeId?: string | null
  txid?: string | null
}

export async function upsertOrder(args: UpsertOrderArgs) {
  const now = new Date()
  const updateValues: Record<string, unknown> = {
    status: args.status,
    updatedAt: now
  }
  const hasAmount = typeof args.amount === 'number'

  if (hasAmount) {
    updateValues.amount = args.amount
  }
  if (args.currency) {
    updateValues.currency = args.currency
  }
  if (args.chargeId !== undefined) {
    updateValues.chargeId = args.chargeId
  }
  if (args.txid !== undefined) {
    updateValues.txid = args.txid
  }

  if (!hasAmount) {
    await db
      .update(ventraSimOrders)
      .set(updateValues)
      .where(and(eq(ventraSimOrders.env, args.env), eq(ventraSimOrders.orderId, args.orderId)))
    return
  }

  const insertValues = {
    env: args.env,
    orderId: args.orderId,
    amount: args.amount,
    currency: args.currency ?? 'BRL',
    status: args.status,
    chargeId: args.chargeId ?? null,
    txid: args.txid ?? null,
    createdAt: now,
    updatedAt: now
  }

  await db
    .insert(ventraSimOrders)
    .values(insertValues)
    .onConflictDoUpdate({
      target: [ventraSimOrders.env, ventraSimOrders.orderId],
      set: updateValues
    })
}

export async function listOrders({ env, limit = 50 }: { env?: OrderEnv; limit?: number } = {}) {
  let query = db
    .select({
      id: ventraSimOrders.id,
      env: ventraSimOrders.env,
      orderId: ventraSimOrders.orderId,
      amount: ventraSimOrders.amount,
      currency: ventraSimOrders.currency,
      status: ventraSimOrders.status,
      chargeId: ventraSimOrders.chargeId,
      txid: ventraSimOrders.txid,
      createdAt: ventraSimOrders.createdAt,
      updatedAt: ventraSimOrders.updatedAt
    })
    .from(ventraSimOrders)

  if (env) {
    query = query.where(eq(ventraSimOrders.env, env))
  }

  return query.orderBy(desc(ventraSimOrders.updatedAt)).limit(limit)
}

export async function getOrderById(orderId: string, env?: OrderEnv) {
  const conditions = [eq(ventraSimOrders.orderId, orderId)]
  if (env) {
    conditions.push(eq(ventraSimOrders.env, env))
  }

  const rows = await db
    .select({
      id: ventraSimOrders.id,
      env: ventraSimOrders.env,
      orderId: ventraSimOrders.orderId,
      amount: ventraSimOrders.amount,
      currency: ventraSimOrders.currency,
      status: ventraSimOrders.status,
      chargeId: ventraSimOrders.chargeId,
      txid: ventraSimOrders.txid,
      createdAt: ventraSimOrders.createdAt,
      updatedAt: ventraSimOrders.updatedAt
    })
    .from(ventraSimOrders)
    .where(and(...conditions))
    .limit(1)
  return rows[0] ?? null
}

export async function listEventsByOrderId(orderId: string) {
  return db
    .select({
      id: webhookEvents.id,
      eventId: webhookEvents.eventId,
      eventType: webhookEvents.eventType,
      orderId: webhookEvents.orderId,
      signatureOk: webhookEvents.signatureOk,
      deltaMs: webhookEvents.deltaMs,
      receivedAt: webhookEvents.receivedAt,
      retryCount: sql<number>`count(${webhookDeliveries.id})`
    })
    .from(webhookEvents)
    .leftJoin(webhookDeliveries, eq(webhookDeliveries.eventId, webhookEvents.eventId))
    .where(eq(webhookEvents.orderId, orderId))
    .groupBy(
      webhookEvents.id,
      webhookEvents.eventId,
      webhookEvents.eventType,
      webhookEvents.orderId,
      webhookEvents.signatureOk,
      webhookEvents.deltaMs,
      webhookEvents.receivedAt
    )
    .orderBy(desc(webhookEvents.receivedAt))
}
