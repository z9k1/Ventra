import { and, eq, sql } from 'drizzle-orm'

import { db } from './index'
import { webhookDeliveries, webhookEndpoints, webhookEvents } from './schema'

export async function getActiveEndpointSecret(env: 'local' | 'sandbox' | 'staging') {
  const rows = await db
    .select({ secret: webhookEndpoints.secret })
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.env, env), eq(webhookEndpoints.isActive, true)))
    .limit(1)
  return rows[0]?.secret ?? null
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
}) {
  await db.insert(webhookDeliveries).values({
    eventId: args.eventId,
    attemptNumber: args.attemptNumber,
    status: args.status,
    errorMessage: args.errorMessage ?? null
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
      receivedAt: webhookDeliveries.receivedAt
    })
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.eventId, eventId))
    .orderBy(webhookDeliveries.attemptNumber)
}
