'use client'

import { useQuery } from '@tanstack/react-query'
import { formatBRL } from '@/lib/format'
import { apiRequest } from '@/lib/apiClient'
import { useEffect, useMemo, useState } from 'react'
import { loadLocalOrders, LocalOrder, pushOrder, updateOrderStatus } from '@/lib/ordersStore'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { useRouter } from 'next/navigation'
import { Timer, Send } from 'lucide-react'

const statusTabs = [
  { label: 'Todos', value: 'ALL' },
  { label: 'Pago', value: 'RELEASED' },
  { label: 'Aguardando', value: 'PAID_IN_ESCROW' },
  { label: 'Cancelado', value: 'REFUNDED' }
]

const statusLabels: Record<string, { label: string; badge: 'success' | 'neutral' }> = {
  RELEASED: { label: 'PAGO', badge: 'success' },
  PAID_IN_ESCROW: { label: 'AGUARDANDO', badge: 'neutral' },
  REFUNDED: { label: 'CANCELADO', badge: 'neutral' },
  AWAITING_PAYMENT: { label: 'PENDENTE', badge: 'neutral' },
  CANCELED: { label: 'CANCELADO', badge: 'neutral' }
}

const createLocalCode = () => `VN-${Math.floor(1000 + Math.random() * 9000)}`

type ChargePreview = {
  pix_emv: string
  expires_at: string
  id: string
  orderId: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<LocalOrder[]>([])
  const [tab, setTab] = useState('ALL')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [chargePreview, setChargePreview] = useState<ChargePreview | null>(null)
  const [loadingAction, setLoadingAction] = useState(false)
  const balanceQuery = useQuery(['balance'], () => apiRequest('/balance'))
  const filtered = useMemo(() => {
    if (tab === 'ALL') return orders
    return orders.filter((order) => order.lastKnownStatus === tab)
  }, [orders, tab])

  useEffect(() => {
    setOrders(loadLocalOrders())
  }, [])

  const handleNewDeposit = async (amount: number) => {
    setLoadingAction(true)
    try {
      const amount_cents = amount
      const order = await apiRequest('/orders', {
        method: 'POST',
        body: { amount_cents, currency: 'BRL' },
        action: 'order'
      })
      const charge = await apiRequest(`/orders/${order.id}/charges/pix`, {
        method: 'POST',
        action: 'charge'
      })
      const local: LocalOrder = {
        orderId: order.id,
        amount_cents: order.amount_cents,
        created_at: order.created_at,
        code: createLocalCode(),
        lastKnownStatus: order.status,
        chargeId: charge.id,
        expires_at: charge.expires_at
      }
      pushOrder(local)
      setOrders(loadLocalOrders())
      setChargePreview({
        pix_emv: charge.pix_emv,
        expires_at: charge.expires_at,
        id: charge.id,
        orderId: order.id
      })
      setDialogOpen(true)
    } catch (error) {
      console.error(error)
    } finally {
      setLoadingAction(false)
    }
  }

  const handleSimulate = async () => {
    if (!chargePreview) return
    setLoadingAction(true)
    try {
      await apiRequest(`/charges/${chargePreview.id}/simulate-paid`, {
        method: 'POST',
        action: 'simulate-paid'
      })
      updateOrderStatus(chargePreview.orderId, 'PAID_IN_ESCROW')
      setOrders(loadLocalOrders())
    } finally {
      setLoadingAction(false)
    }
  }

  const navTo = (orderId: string) => {
    router.push(`/wallet?orderId=${orderId}`)
  }

  return (
    <div className="space-y-5 pb-28">
      <section>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-textSecondary">Visão Geral</p>
            <p className="text-2xl font-semibold">Saldo total</p>
          </div>
          <div className="px-3 py-1 rounded-full border border-stroke bg-mutedChip text-[10px] uppercase tracking-[0.3em]">
            UPDATED: NOW
          </div>
        </div>
        <Card className="mt-4 space-y-3">
          <div className="text-sm text-textSecondary">Saldo merchant</div>
          <div className="text-4xl font-bold tracking-tight">{formatBRL(balanceQuery.data?.merchant_balance ?? 0)}</div>
          <p className="text-xs text-textSecondary">+12.5% vs mês anterior</p>
        </Card>
      </section>

      <section className="space-y-3">
        <Card className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-textSecondary">AGUARDANDO LIBERAÇÃO</p>
            <p className="text-xl font-semibold">{formatBRL(balanceQuery.data?.escrow_balance ?? 0)}</p>
          </div>
          <div className="text-2xl text-textSecondary">
            <Timer />
          </div>
        </Card>
        <Button onClick={() => handleNewDeposit(150000)} className="h-14 text-base flex items-center justify-center gap-2">
          <Send size={16} /> Novo Depósito
        </Button>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <p className="text-lg font-semibold">Transações Recentes</p>
        </div>
        <Tabs tabs={statusTabs} value={tab} onValueChange={setTab} />
        <div className="space-y-3 mt-4">
          {filtered.length === 0 && <p className="text-textSecondary text-sm">Nenhuma transação</p>}
          {filtered.map((order) => {
            const status = statusLabels[order.lastKnownStatus] ?? { label: 'PENDENTE', badge: 'neutral' }
            return (
              <div
                key={order.orderId}
                className="card-base p-4 cursor-pointer hover:border-accent transition border border-stroke"
                onClick={() => navTo(order.orderId)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl border border-stroke grid place-items-center">{order.code.split('-')[1]}</div>
                    <div>
                      <p className="text-sm font-semibold">Pedido #{order.code}</p>
                      <p className="text-xs text-textSecondary">Custódia Pix • Escrow</p>
                    </div>
                  </div>
                  <Badge variant={status.badge}>{status.label}</Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-textSecondary">
                  <span>{new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short', dateStyle: 'short' }).format(new Date(order.created_at))}</span>
                  <b>{formatBRL(order.amount_cents)}</b>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {chargePreview && dialogOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4">
          <div className="card-base w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Cobrança Pix</h3>
              <button onClick={() => setDialogOpen(false)} className="text-textSecondary">Fechar</button>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-textSecondary uppercase tracking-[0.3em]">PIX</p>
              <textarea readOnly value={chargePreview.pix_emv} className="w-full rounded-xl bg-mutedChip border border-stroke p-3 text-xs min-h-[110px]" />
              <div className="flex justify-between text-xs">
                <span>Expira em {new Date(chargePreview.expires_at).toLocaleTimeString('pt-BR')}</span>
                <button onClick={() => navigator.clipboard.writeText(chargePreview.pix_emv)} className="text-accent">Copiar</button>
              </div>
            </div>
            <Button onClick={handleSimulate} className="h-12 text-base">
              Simular pagamento
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
