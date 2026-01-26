import Link from 'next/link'
import { notFound } from 'next/navigation'

import EventsListClient from '@/app/events/EventsListClient'
import CopyButton from '@/app/orders/components/CopyButton'
import OrderActions from '@/app/orders/components/OrderActions'
import { getOrderById, listEventsByOrderId, OrderEnv } from '@/db/queries'

const allowedEnvs: OrderEnv[] = ['local', 'sandbox', 'staging']

const statusBadgeClasses: Record<string, string> = {
  AWAITING_PAYMENT: 'bg-amber-100 text-amber-800',
  PAID: 'bg-emerald-100 text-emerald-700',
  IN_ESCROW: 'bg-sky-100 text-sky-700',
  RELEASED: 'bg-blue-100 text-blue-700',
  REFUNDED: 'bg-rose-100 text-rose-700'
}

const formatCurrency = (amount?: number | null) => {
  if (typeof amount !== 'number') return '-'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount / 100)
}

export default async function OrderDetailPage({
  params,
  searchParams
}: {
  params: { orderId: string }
  searchParams?: { env?: string }
}) {
  const requestedEnv = (searchParams?.env ?? '') as string
  const envFilter = allowedEnvs.includes(requestedEnv as OrderEnv) ? (requestedEnv as OrderEnv) : undefined
  const order = await getOrderById(params.orderId, envFilter)
  if (!order) {
    return notFound()
  }

  const events = await listEventsByOrderId(order.orderId)

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900">Pedido {order.orderId}</h1>
          <p className="text-sm text-zinc-500">Detalhes vindos da cache local e dos webhooks.</p>
        </div>
        <Link
          href={`/events?orderId=${order.orderId}`}
          className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600"
        >
          Abrir na timeline
        </Link>
      </div>

      <section className="space-y-4 rounded-3xl border border-zinc-200 bg-white/60 p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Order ID</p>
            <div className="mt-2 flex items-center gap-2 font-mono text-sm text-zinc-900">
              <span className="truncate">{order.orderId}</span>
              <CopyButton value={order.orderId} />
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Charge ID</p>
            <p className="mt-2 font-mono text-sm text-zinc-900">{order.chargeId ?? '-'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">TXID</p>
            <p className="mt-2 font-mono text-sm text-zinc-900">{order.txid ?? '-'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Amount</p>
            <p className="mt-2 font-semibold text-zinc-900">{formatCurrency(order.amount)}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span
            className={`inline-flex rounded-full px-3 py-1 font-semibold ${
              statusBadgeClasses[order.status] ?? 'bg-zinc-100 text-zinc-600'
            }`}
          >
            {order.status}
          </span>
          <span className="text-xs uppercase tracking-[0.3em] text-zinc-500">Env {order.env}</span>
          <span className="text-xs text-zinc-500">Updated: {new Date(order.updatedAt).toLocaleString()}</span>
        </div>
        <OrderActions orderId={order.orderId} />
      </section>

      <section className="space-y-4 rounded-3xl border border-zinc-200 bg-white/60 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Events</h2>
          <span className="text-xs text-zinc-500">{events.length} event(s)</span>
        </div>
        <EventsListClient rows={events} />
      </section>
    </main>
  )
}
