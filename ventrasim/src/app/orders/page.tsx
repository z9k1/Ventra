import Link from 'next/link'

import { listOrders, OrderEnv } from '@/db/queries'
import CopyButton from './components/CopyButton'

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

export default async function OrdersPage({
  searchParams
}: {
  searchParams?: Promise<{ env?: string }>
}) {
  const sp = (await searchParams) ?? {}
  const selectedEnv = (sp.env ?? '') as string
  const envFilter = allowedEnvs.includes(selectedEnv as OrderEnv) ? (selectedEnv as OrderEnv) : undefined
  const orders = await listOrders({ env: envFilter, limit: 200 })

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-zinc-900">Orders</h1>
        <p className="text-sm text-zinc-500">Cache local baseado em eventos e chamadas ativas ao Ventra.</p>
      </header>

      <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-sm text-zinc-600">
            <span>Filtro de ambiente:</span>
            <form method="get" className="flex items-center gap-2">
              <label className="text-xs uppercase tracking-[0.3em] text-zinc-500">Env</label>
              <select
                name="env"
                defaultValue={selectedEnv}
                className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs"
              >
                <option value="">Todos</option>
                {allowedEnvs.map((env) => (
                  <option value={env} key={env}>
                    {env}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-lg bg-zinc-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-white"
              >
                Aplicar
              </button>
            </form>
          </div>
          <Link href="/events" className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">
            Ver timeline completa
          </Link>
        </div>
        <div className="text-xs text-zinc-500">
          {envFilter ? `Mostrando pedidos do ambiente ${envFilter}.` : 'Sem filtro: exibindo todos os ambientes.'}
        </div>
      </section>

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              <th className="px-4 py-3">Order ID</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3">Env</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-900">
                    <span className="truncate w-32">{order.orderId}</span>
                    <CopyButton value={order.orderId} />
                  </div>
                </td>
                <td className="px-4 py-3 font-semibold text-zinc-900">{formatCurrency(order.amount)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 font-semibold ${
                      statusBadgeClasses[order.status] ?? 'bg-zinc-100 text-zinc-600'
                    }`}
                  >
                    {order.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-500">
                  {order.updatedAt ? new Date(order.updatedAt).toLocaleString() : '-'}
                </td>
                <td className="px-4 py-3 text-xs uppercase tracking-[0.2em] text-zinc-500">{order.env}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/orders/${order.orderId}${envFilter ? `?env=${envFilter}` : ''}`}
                    className="text-xs font-semibold text-blue-600 underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-xs text-zinc-500">
                  Nenhum pedido encontrado para o filtro selecionado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
