import { NextRequest, NextResponse } from 'next/server'

import { releaseOrder } from '@/lib/ventraClient'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params
  if (!orderId) {
    return NextResponse.json({ error: 'order_id_required' }, { status: 400 })
  }

  try {
    const payload = await releaseOrder(orderId)
    return NextResponse.json({ ok: true, payload }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'release_failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
