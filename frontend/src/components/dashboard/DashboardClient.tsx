'use client'

import { useMemo, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'

import { apiRequest } from '@/lib/api'
import type { Balance, Order } from '@/lib/types'
import { loadLocalOrders, updateLocalOrder } from '@/lib/localOrders'

import { BalanceCards } from './BalanceCards'
import { TransactionsList } from './TransactionsList'
import { NewDepositDialog } from './NewDepositDialog'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function DashboardClient() {
  const router = useRouter()
  const [refreshKey, setRefreshKey] = useState(0)

  const localOrders = useMemo(() => {
    // refreshKey forces reload after dialog actions
    void refreshKey
    return loadLocalOrders()
  }, [refreshKey])

  const balanceQuery = useQuery({
    queryKey: ['wallet', 'balances'],
    queryFn: () => apiRequest<Balance>('/balance'),
    staleTime: 10_000
  })

  useQueries({
    queries: localOrders.map((order) => ({
      queryKey: ['deposit', order.orderId],
      queryFn: () => apiRequest<Order>(`/orders/${order.orderId}`),
      enabled: Boolean(order.orderId),
      staleTime: 8_000,
      onSuccess: (data: Order) => {
        if (data.status !== order.lastKnownStatus) {
          updateLocalOrder(order.orderId, { lastKnownStatus: data.status, chargeId: data.charge?.id ?? undefined })
          setRefreshKey((prev) => prev + 1)
        }
      }
    }))
  })

  const onCreated = () => {
    setRefreshKey((prev) => prev + 1)
    balanceQuery.refetch()
  }

  return (
    <div className="space-y-6">
      <section className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Visão Geral</h1>
        </div>
        <div className="ventra-pill px-4 py-2 text-xs uppercase tracking-[0.32em] text-muted-foreground">
          UPDATED: NOW
        </div>
      </section>

      {balanceQuery.isError && (
        <Card className="p-5 space-y-3">
          <p className="text-sm text-muted-foreground">
            {(balanceQuery.error as any)?.message || 'Nao foi possivel carregar o saldo.'}
          </p>
          <Button variant="outline" onClick={() => router.push('/settings')}>
            Abrir Settings
          </Button>
        </Card>
      )}

      <BalanceCards
        available={balanceQuery.data?.available_balance_cents ?? 0}
        escrow={balanceQuery.data?.escrow_balance_cents ?? 0}
        total={balanceQuery.data?.total_balance_cents ?? 0}
      />

      <NewDepositDialog onCreated={onCreated} />

      <TransactionsList
        orders={localOrders}
        onClick={(orderId) => router.push(`/wallet?orderId=${orderId}`)}
      />
    </div>
  )
}
