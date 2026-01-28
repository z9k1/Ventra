import { NextRequest, NextResponse } from 'next/server'

import { refundOrder } from '@/lib/ventraClient'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const baseUrl = request.headers.get('x-api-base-url')?.trim() || undefined
  const apiKey = request.headers.get('x-api-key')?.trim() || undefined
  const override = baseUrl || apiKey ? { baseUrl, apiKey } : undefined

  const { orderId } = await params
  if (!orderId) {
    return NextResponse.json({ error: 'order_id_required' }, { status: 400 })
  }

  try {
    const payload = await refundOrder(orderId, override)
    return NextResponse.json({ ok: true, payload }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'refund_failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
