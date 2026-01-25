'use client'

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Search } from 'lucide-react'

import { apiRequest } from '@/lib/api'
import type { LedgerEntry, Order } from '@/lib/types'
import { updateLocalOrder, upsertLocalOrder } from '@/lib/localOrders'
import { formatBRL } from '@/lib/format'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/use-toast'

export default function WalletPageClient({ initialOrderId }: { initialOrderId: string }) {
  const [orderId, setOrderId] = useState(initialOrderId)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const orderQuery = useQuery({
    queryKey: ['wallet-order', orderId],
    queryFn: () => apiRequest<Order>(`/orders/${orderId}`),
    enabled: Boolean(orderId)
  })

  const ledgerQuery = useQuery({
    queryKey: ['wallet-ledger', orderId],
    queryFn: () => apiRequest<LedgerEntry[]>(`/orders/${orderId}/ledger`),
    enabled: Boolean(orderId)
  })

  useEffect(() => {
    if (!orderQuery.data) return
    upsertLocalOrder({
      orderId: orderQuery.data.id,
      amount_cents: orderQuery.data.amount_cents,
      created_at: orderQuery.data.created_at,
      localCode: `VN-${String(orderQuery.data.id).slice(-4).toUpperCase()}`,
      lastKnownStatus: orderQuery.data.status,
      chargeId: orderQuery.data.charge?.id
    })
  }, [orderQuery.data])

  const [busy, setBusy] = useState(false)
  const status = orderQuery.data?.status
  const charge = orderQuery.data?.charge

  const variant = status === 'RELEASED' ? 'success' : 'neutral'

  const runAction = async (kind: 'simulate' | 'release' | 'refund') => {
    if (!orderQuery.data) return

    setBusy(true)
    try {
      if (kind === 'simulate') {
        if (!charge) return
        await apiRequest(`/charges/${charge.id}/simulate-paid`, { method: 'POST', action: 'simulate-paid' })
      }
      if (kind === 'release') {
        await apiRequest(`/orders/${orderId}/release`, { method: 'POST', action: 'release' })
      }
      if (kind === 'refund') {
        await apiRequest(`/orders/${orderId}/refund`, { method: 'POST', action: 'refund' })
      }

      await queryClient.invalidateQueries({ queryKey: ['wallet-order', orderId] })
      await queryClient.invalidateQueries({ queryKey: ['wallet-ledger', orderId] })

      const updated = await apiRequest<Order>(`/orders/${orderId}`)
      updateLocalOrder(orderId, { lastKnownStatus: updated.status, chargeId: updated.charge?.id })

      toast({ title: 'Sucesso', description: 'Acao executada.', variant: 'success' })
    } catch (error: any) {
      toast({ title: 'Erro', description: error?.message || 'Falha na acao', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Wallet</h1>
        <p className="text-sm text-muted-foreground">Cole um Order ID para ver detalhes.</p>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <input
            value={orderId}
            onChange={(event) => setOrderId(event.target.value.trim())}
            placeholder="orderId"
            className="w-full rounded-[16px] border border-border bg-black/20 px-4 py-3"
          />
        </div>
        <Button size="icon" variant="outline" type="button" onClick={() => queryClient.invalidateQueries({ queryKey: ['wallet-order', orderId] })}>
          <Search size={18} />
        </Button>
      </div>

      {orderQuery.isError && (
        <Card className="p-5 text-sm text-red-400">{(orderQuery.error as any)?.message || 'Erro ao buscar ordem'}</Card>
      )}

      {orderQuery.data && (
        <Card className="p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={variant}>{status}</Badge>
            </div>
            <div className="text-3xl font-bold tracking-tight">{formatBRL(orderQuery.data.amount_cents)}</div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-3">
            <div className="ventra-card p-4">
              <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Charge</p>
              <p className="mt-2 text-sm font-semibold">{charge?.status ?? '-'}</p>
            </div>
            <div className="ventra-card p-4">
              <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Expira</p>
              <p className="mt-2 text-sm font-semibold">
                {charge?.expires_at
                  ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
                      new Date(charge.expires_at)
                    )
                  : '-'}
              </p>
            </div>
          </div>

          {charge?.pix_emv && (
            <textarea
              readOnly
              value={charge.pix_emv}
              className="w-full min-h-[120px] rounded-[16px] border border-border bg-black/20 p-3 text-xs"
            />
          )}

          <div className="grid grid-cols-3 gap-2">
            <Button disabled={busy || !charge || charge.status !== 'PENDING'} onClick={() => runAction('simulate')}>
              {busy ? <Loader2 className="animate-spin" size={16} /> : 'Simular'}
            </Button>
            <Button variant="outline" disabled={busy || status !== 'PAID_IN_ESCROW'} onClick={() => runAction('refund')}>
              Reembolsar
            </Button>
            <Button disabled={busy || status !== 'PAID_IN_ESCROW'} onClick={() => runAction('release')}>
              Liberar
            </Button>
          </div>
        </Card>
      )}

      {ledgerQuery.data && ledgerQuery.data.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">Ledger</p>
          <Card className="p-5 space-y-3">
            {ledgerQuery.data.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{String(entry.type).replace(/_/g, ' ')}</p>
                  <p className="text-xs text-muted-foreground">{entry.account}</p>
                </div>
                <p className="text-sm font-semibold">{formatBRL(entry.amount_cents)}</p>
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  )
}
