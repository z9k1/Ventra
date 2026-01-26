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
