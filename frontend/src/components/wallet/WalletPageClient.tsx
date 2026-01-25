'use client'

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Loader2, Search, XCircle } from 'lucide-react'

import { apiRequest } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { LedgerEntry, Order } from '@/lib/types'
import { updateLocalOrder, upsertLocalOrder } from '@/lib/localOrders'
import { formatBRL } from '@/lib/format'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/use-toast'

const statusMap: Record<string, string> = {
  AWAITING_PAYMENT: 'Aguardando pagamento',
  PAID_IN_ESCROW: 'Em custódia',
  RELEASED: 'Liberado',
  REFUNDED: 'Reembolsado',
  CANCELED: 'Cancelado'
}

type UIStatus = 'idle' | 'processing' | 'approved' | 'released' | 'refunded' | 'error'

export default function WalletPageClient({ initialOrderId }: { initialOrderId: string }) {
  const [orderId, setOrderId] = useState(initialOrderId)
  const [uiStatus, setUiStatus] = useState<UIStatus>('idle')
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const orderQuery = useQuery({
    queryKey: ['deposit', orderId],
    queryFn: () => apiRequest<Order>(`/orders/${orderId}`),
    enabled: Boolean(orderId)
  })

  const ledgerQuery = useQuery({
    queryKey: ['ledger', orderId],
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

  const handleCopyPix = () => {
    if (charge?.pix_emv) {
      navigator.clipboard.writeText(charge.pix_emv)
      toast({ title: 'Copiado', description: 'Código Pix copiado.' })
    }
  }

  const runAction = async (kind: 'simulate' | 'release' | 'refund') => {
    if (!orderQuery.data) return

    setBusy(true)
    setUiStatus('processing')
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

      await queryClient.invalidateQueries({ queryKey: ['deposit', orderId] })
      await queryClient.invalidateQueries({ queryKey: ['ledger', orderId] })
      await queryClient.invalidateQueries({ queryKey: ['wallet', 'balances'] })

      const updated = await apiRequest<Order>(`/orders/${orderId}`)
      updateLocalOrder(orderId, { lastKnownStatus: updated.status, chargeId: updated.charge?.id })

      if (kind === 'simulate') {
        setUiStatus('approved')
      } else if (kind === 'release') {
        setUiStatus('released')
      } else if (kind === 'refund') {
        setUiStatus('refunded')
      }

      setTimeout(() => {
        setUiStatus('idle')
        setBusy(false)
      }, 1000)

    } catch (error: any) {
      setUiStatus('idle')
      setBusy(false)
      toast({ title: 'Erro', description: error?.message || 'Falha na acao', variant: 'destructive' })
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
        <Button size="icon" variant="outline" type="button" onClick={() => queryClient.invalidateQueries({ queryKey: ['deposit', orderId] })}>
          <Search size={18} />
        </Button>
      </div>

      {orderQuery.isError && (
        <Card className="p-5 text-sm text-red-400">{(orderQuery.error as any)?.message || 'Erro ao buscar ordem'}</Card>
      )}

      {orderQuery.data && (
        <Card className="p-5 space-y-4 relative overflow-hidden">
          {uiStatus !== 'idle' && (
            <div className={cn(
              "absolute inset-0 z-50 flex flex-col items-center justify-center transition-all duration-300",
              uiStatus === 'processing' ? "bg-accent text-accent-foreground" : "bg-background"
            )}>
              {uiStatus === 'processing' && (
                <>
                  <Loader2 className="h-12 w-12 animate-spin mb-4" />
                  <h3 className="text-xl font-semibold">Processando...</h3>
                </>
              )}
              {uiStatus === 'approved' && (
                <>
                  <CheckCircle2 className="h-16 w-16 text-accent mb-4" />
                  <h3 className="text-2xl font-bold text-center px-6">Pagamento aprovado</h3>
                  <p className="text-muted-foreground mt-2 text-center px-6">Valor em custódia.</p>
                </>
              )}
              {uiStatus === 'released' && (
                <>
                  <CheckCircle2 className="h-16 w-16 text-accent mb-4" />
                  <h3 className="text-2xl font-bold text-center px-6">Pagamento liberado</h3>
                  <p className="text-muted-foreground mt-2 text-center px-6">Valor enviado ao recebedor.</p>
                </>
              )}
              {uiStatus === 'refunded' && (
                <>
                  <XCircle className="h-16 w-16 text-destructive mb-4" />
                  <h3 className="text-2xl font-bold text-center px-6">Pagamento reembolsado</h3>
                  <p className="text-muted-foreground mt-2 text-center px-6">O valor foi devolvido ao pagador.</p>
                </>
              )}
            </div>
          )}

          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={variant}>{status ? (statusMap[status] || status) : '-'}</Badge>
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

          {charge?.pix_emv && status === 'AWAITING_PAYMENT' && (
            <textarea
              readOnly
              value={charge.pix_emv}
              className="w-full min-h-[120px] rounded-[16px] border border-border bg-black/20 p-3 text-xs"
            />
          )}

          <div className="grid grid-cols-2 gap-2">
            {status === 'AWAITING_PAYMENT' && (
              <>
                <Button variant="outline" disabled={busy} onClick={handleCopyPix}>
                  Copiar Pix
                </Button>
                <Button disabled={busy || !charge || charge.status !== 'PENDING'} onClick={() => runAction('simulate')}>
                  {busy ? 'Processando...' : 'Simular pagamento'}
                </Button>
              </>
            )}

            {status === 'PAID_IN_ESCROW' && (
              <>
                <Button variant="outline" disabled={busy} onClick={() => runAction('refund')}>
                  Reembolsar
                </Button>
                <Button disabled={busy} onClick={() => runAction('release')}>
                  Liberar
                </Button>
              </>
            )}

            {status && ['RELEASED', 'REFUNDED', 'CANCELED'].includes(status) && (
              <div className="col-span-2 ventra-card p-3 text-center text-sm font-medium text-muted-foreground">
                Ordem finalizada
              </div>
            )}
          </div>

          {status && (
            <div className="pt-2">
              <div className="flex items-center justify-between px-1">
                {[
                  { label: 'Criada', done: true },
                  { label: 'Paga', done: ['PAID_IN_ESCROW', 'RELEASED', 'REFUNDED'].includes(status) },
                  { label: 'Em custódia', done: ['PAID_IN_ESCROW', 'RELEASED', 'REFUNDED'].includes(status) },
                  {
                    label: status === 'REFUNDED' ? 'Reembolsada' : 'Liberada',
                    done: ['RELEASED', 'REFUNDED'].includes(status)
                  }
                ].map((step, i, arr) => (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <div className="flex items-center">
                      <div
                        className={cn(
                          'h-2 w-2 rounded-full',
                          step.done ? 'bg-accent' : 'bg-muted'
                        )}
                      />
                      {i < arr.length - 1 && (
                        <div
                          className={cn('h-[1px] w-6 sm:w-12 mx-1', step.done && arr[i + 1].done ? 'bg-accent' : 'bg-muted')}
                        />
                      )}
                    </div>
                    <span
                      className={cn(
                        'text-[10px] uppercase tracking-tighter font-medium',
                        step.done ? 'text-foreground' : 'text-muted-foreground'
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
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
