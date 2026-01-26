import { and, eq, sql } from 'drizzle-orm'

import { db } from './index'
import { webhookDeliveries, webhookEndpoints, webhookEvents } from './schema'

export async function getEndpointConfig(env: 'local' | 'sandbox' | 'staging') {
  const rows = await db
    .select({
      env: webhookEndpoints.env,
      secret: webhookEndpoints.secret,
      deliveryMode: webhookEndpoints.deliveryMode,
      timeoutMs: webhookEndpoints.timeoutMs
    })
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.env, env))
    .limit(1)
  return rows[0] ?? null
}

export async function upsertEndpointConfig(env: 'local' | 'sandbox' | 'staging') {
  const existing = await getEndpointConfig(env)
  if (existing) return existing

  const [inserted] = await db
    .insert(webhookEndpoints)
    .values({
      env,
      secret: 'ventra-sim-secret', // Default secret
      deliveryMode: 'normal',
      timeoutMs: 15000,
      isActive: true
    })
    .returning({
      env: webhookEndpoints.env,
      secret: webhookEndpoints.secret,
      deliveryMode: webhookEndpoints.deliveryMode,
      timeoutMs: webhookEndpoints.timeoutMs
    })
  return inserted
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
      timeoutMs: args.timeoutMs
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
}) {
  await db.insert(webhookDeliveries).values({
    eventId: args.eventId,
    attemptNumber: args.attemptNumber,
    status: args.status,
    errorMessage: args.errorMessage ?? null,
    modeUsed: args.modeUsed ?? null,
    latencyMs: args.latencyMs ?? null
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
      receivedAt: webhookDeliveries.receivedAt
    })
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.eventId, eventId))
    .orderBy(webhookDeliveries.attemptNumber)
}
