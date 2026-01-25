'use client'

import { useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { formatDistanceToNowStrict } from 'date-fns'

import { apiRequest } from '@/lib/api'
import type { LedgerEntry, Order } from '@/lib/types'
import { loadLocalOrders } from '@/lib/localOrders'

import { Card } from '@/components/ui/card'

type FeedItem = {
  id: string
  event: string
  created_at: string
  orderId: string
}

export default function ActivityClient() {
  const orders = useMemo(() => loadLocalOrders(), [])
  const [items, setItems] = useState<FeedItem[]>([])

  useQueries({
    queries: orders.map((o) => ({
      queryKey: ['ledger', o.orderId],
      queryFn: () => apiRequest<LedgerEntry[]>(`/orders/${o.orderId}/ledger`),
      enabled: Boolean(o.orderId),
      onSuccess: (data: LedgerEntry[]) => {
        const mapped = data.map((entry) => ({
          id: entry.id,
          event: entry.type,
          created_at: entry.created_at,
          orderId: o.orderId
        }))

        setItems((prev) => {
          const next = [...mapped, ...prev]
          const dedup = Array.from(new Map(next.map((x) => [x.id, x])).values())
          dedup.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          return dedup.slice(0, 50)
        })
      }
    }))
  })

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Activity</h1>
        <p className="text-sm text-muted-foreground">Eventos derivados do ledger.</p>
      </div>

      <div className="space-y-3">
        {items.length === 0 && <Card className="p-6 text-center text-muted-foreground">Sem eventos ainda.</Card>}
        {items.map((item) => (
          <Card key={item.id} className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">{item.event.replace(/_/g, '.').toLowerCase()}</p>
              <p className="text-xs text-muted-foreground font-mono">{item.orderId.slice(0, 8)}...</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNowStrict(new Date(item.created_at), { addSuffix: true })}
            </p>
          </Card>
        ))}
      </div>
    </div>
  )
}