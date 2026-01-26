import { NextResponse } from 'next/server'

import { getWebhookEventByEventId, listDeliveriesByEventId } from '@/db/queries'

export async function GET(
  _request: Request,
  context: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await context.params
  const event = await getWebhookEventByEventId(eventId)

  if (!event) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const deliveries = await listDeliveriesByEventId(eventId)
  const retryCount = deliveries.length
  const deltaSeconds = typeof event.deltaMs === 'number' ? Math.round(event.deltaMs / 1000) : null

  return NextResponse.json({
    event,
    deliveries,
    retryCount,
    deltaSeconds
  })
}
