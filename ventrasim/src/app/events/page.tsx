import { db } from '@/db'
import { webhookDeliveries, webhookEvents } from '@/db/schema'
import { desc, eq, sql } from 'drizzle-orm'

import EventsListClient from './EventsListClient'

export default async function EventsPage() {
  const rows = await db
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
    .limit(50)

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-4">VentraSim - Eventos</h1>
      <EventsListClient rows={rows} />
    </main>
  )
}
