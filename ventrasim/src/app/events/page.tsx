import { db } from '@/db'
import { webhookDeliveries, webhookEvents } from '@/db/schema'
import { desc, eq, sql } from 'drizzle-orm'

import EventsListClient from './EventsListClient'
import FailureModeToggle from './FailureModeToggle'

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
    <main className="p-8 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Webhook Events</h1>
        <p className="text-zinc-500 mt-1">Simulação de recebimento e latência do Ventra</p>
      </header>

      <FailureModeToggle />

      <EventsListClient rows={rows} />
    </main>
  )
}
