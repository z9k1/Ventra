'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '@/lib/apiClient'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatBRL } from '@/lib/format'
import { LocalOrder, pushOrder, updateOrderStatus } from '@/lib/ordersStore'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'

export default function WalletPage() {
  const params = useSearchParams()
  const orderIdFromParams = params.get('orderId') ?? ''
  const [inputValue, setInputValue] = useState(orderIdFromParams)
  const queryClient = useQueryClient()

  const orderQuery = useQuery(
    ['order', inputValue],
    () => apiRequest(`/orders/${inputValue}`),
    {
      enabled: inputValue.length > 0
    }
  )

  const ledgerQuery = useQuery(
    ['ledger', inputValue],
    () => apiRequest(`/orders/${inputValue}/ledger`),
    {
      enabled: inputValue.length > 0
    }
  )

  useEffect(() => {
    if (!orderQuery.data) return
    const existing: LocalOrder = {
      orderId: orderQuery.data.id,
      amount_cents: orderQuery.data.amount_cents,
      created_at: orderQuery.data.created_at,
      code: `VN-${orderQuery.data.id.slice(-4).toUpperCase()}`,
      lastKnownStatus: orderQuery.data.status
    }
    pushOrder(existing)
  }, [orderQuery.data])

  const charge = orderQuery.data?.charge
  const actionsDisabled = orderQuery.isLoading || ledgerQuery.isLoading
  const [actionLoading, setActionLoading] = useState(false)

  const statusText = orderQuery.data?.status ?? 'Carregando...'
  const statusBadge = statusText === 'RELEASED' ? 'success' : 'neutral'

  const handleAction = async (action: 'simulate' | 'release' | 'refund') => {
    if (!charge && action === 'simulate') return
    setActionLoading(true)
    try {
      if (action === 'simulate' && charge) {
        await apiRequest(`/charges/${charge.id}/simulate-paid`, { method: 'POST', action: 'simulate-paid' })
        updateOrderStatus(inputValue, 'PAID_IN_ESCROW')
      }
      if (action === 'release') {
        await apiRequest(`/orders/${inputValue}/release`, { method: 'POST', action: 'release' })
        updateOrderStatus(inputValue, 'RELEASED')
      }
      if (action === 'refund') {
        await apiRequest(`/orders/${inputValue}/refund`, { method: 'POST', action: 'refund' })
        updateOrderStatus(inputValue, 'REFUNDED')
      }
      queryClient.invalidateQueries({ queryKey: ['order', inputValue] })
      queryClient.invalidateQueries({ queryKey: ['ledger', inputValue] })
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-5 pb-28">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-textSecondary">Wallet</p>
        <h1 className="text-2xl font-semibold">Ordem específica</h1>
      </div>
      <input
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
        placeholder="Cole um orderId"
        className="w-full rounded-[16px] bg-mutedChip border border-stroke p-3 text-sm"
      />
      {inputValue && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-textSecondary">Status atual</p>
              <Badge variant={statusBadge}>{statusText}</Badge>
            </div>
            <div className="text-3xl font-semibold">{formatBRL(orderQuery.data?.amount_cents ?? 0)}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-[14px] border border-stroke bg-black/40 text-xs">
              <p className="text-[11px] text-textSecondary">Charge status</p>
              <p className="font-semibold text-sm">{charge?.status ?? '—'}</p>
            </div>
            <div className="p-3 rounded-[14px] border border-stroke bg-black/40 text-xs">
              <p className="text-[11px] text-textSecondary">Expira em</p>
              <p className="font-semibold text-sm">
                {charge?.expires_at ? new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' }).format(new Date(charge.expires_at)) : '—'}
              </p>
            </div>
          </div>
          {charge?.pix_emv && (
            <textarea readOnly value={charge.pix_emv} className="w-full rounded-xl bg-mutedChip border border-stroke p-3 text-xs min-h-[110px]" />
          )}
          <div className="flex flex-col gap-2">
            <Button disabled={actionLoading || !!charge?.status && charge.status !== 'PENDING'} onClick={() => handleAction('simulate')}>
              {actionLoading ? <Loader2 className="animate-spin" size={16} /> : 'Simular pagamento'}
            </Button>
            <Button disabled={actionLoading || statusText !== 'PAID_IN_ESCROW'} variant="ghost" onClick={() => handleAction('release')}>
              Liberar
            </Button>
            <Button disabled={actionLoading || statusText !== 'PAID_IN_ESCROW'} variant="ghost" onClick={() => handleAction('refund')}>
              Reembolsar
            </Button>
          </div>
        </Card>
      )}

      {ledgerQuery.data && ledgerQuery.data.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-textSecondary">Ledger</p>
          <Card className="space-y-3">
            {ledgerQuery.data.map((entry: any) => (
              <div key={entry.id} className="flex items-center justify-between text-xs text-textSecondary">
                <div>
                  <p className="text-sm text-textPrimary">{entry.type.replace('_', ' ')}</p>
                  <p className="text-[11px]">{entry.account}</p>
                </div>
                <span className="font-semibold text-sm">{formatBRL(entry.amount_cents)}</span>
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  )
}
