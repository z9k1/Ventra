'use client'

import { useEffect, useMemo, useState } from 'react'
import { LocalOrder, loadLocalOrders } from '@/lib/ordersStore'
import { Card } from '@/components/ui/card'
import { formatBRL } from '@/lib/format'

const eventMap: Record<string, { label: string; tone: 'positive' | 'neutral' }> = {
  CREATED: { label: 'charge.created', tone: 'neutral' },
  AWAITING_PAYMENT: { label: 'charge.created', tone: 'neutral' },
  PAID_IN_ESCROW: { label: 'charge.paid', tone: 'positive' },
  RELEASED: { label: 'order.released', tone: 'positive' },
  REFUNDED: { label: 'order.refunded', tone: 'neutral' }
}

export default function ActivityPage() {
  const [orders, setOrders] = useState<LocalOrder[]>([])

  useEffect(() => {
    setOrders(loadLocalOrders())
  }, [])

  const events = useMemo(() => {
    return orders.flatMap((order) => {
      const status = eventMap[order.lastKnownStatus] || { label: 'charge.created', tone: 'neutral' }
      return [
        {
          id: `${order.orderId}-${order.lastKnownStatus}`,
          label: status.label,
          amount: order.amount_cents,
          created_at: order.created_at,
          tone: status.tone
        }
      ]
    })
  }, [orders])

  return (
    <div className="space-y-4 pb-28">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-textSecondary">Activity feed</p>
          <p className="text-2xl font-semibold">Eventos recentes</p>
        </div>
      </div>
      <div className="space-y-3">
        {events.length === 0 && <p className="text-textSecondary text-sm">Sem eventos registrados</p>}
        {events.map((event) => (
          <Card key={event.id} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl border border-stroke grid place-items-center text-xs text-textSecondary">{event.id.slice(-3)}</div>
            <div className="flex-1">
              <p className="text-sm font-semibold">{event.label}</p>
              <p className="text-[11px] text-textSecondary">{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(event.created_at))}</p>
            </div>
            <span className={event.tone === 'positive' ? 'text-accent text-sm font-semibold' : 'text-textSecondary text-sm'}>
              {formatBRL(event.amount)}
            </span>
          </Card>
        ))}
      </div>
    </div>
  )
}
