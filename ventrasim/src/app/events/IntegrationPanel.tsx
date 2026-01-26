'use client'

import { FormEvent, useEffect, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type IntegrationPanelProps = {
  initialOrderFilter?: string
}

type EscrowOrder = {
  id: string
  status: string
  amount_cents: number
  currency: string
  created_at: string
  updated_at: string
}

type EscrowCharge = {
  id: string
  order_id: string
  status: string
  expires_at: string
  pix_emv: string
  txid: string
}

type EscrowCreationResponse = {
  order: EscrowOrder
  charge: EscrowCharge
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100)

export default function IntegrationPanel({ initialOrderFilter }: IntegrationPanelProps) {
  const router = useRouter()
  const pathname = usePathname() ?? '/events'
  const searchParams = useSearchParams()
  const [amount, setAmount] = useState('100')
  const [result, setResult] = useState<EscrowCreationResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterInput, setFilterInput] = useState(initialOrderFilter ?? '')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setFilterInput(initialOrderFilter ?? '')
  }, [initialOrderFilter])

  const applyFilter = (value?: string) => {
    const nextFilter = (value ?? filterInput).trim()
    startTransition(() => {
      const params = new URLSearchParams(searchParams?.toString() ?? '')
      if (nextFilter) {
        params.set('orderId', nextFilter)
      } else {
        params.delete('orderId')
      }
      const query = params.toString()
      const destination = `${pathname}${query ? `?${query}` : ''}`
      router.push(destination)
    })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const cleaned = amount.replace(',', '.').trim()
    if (!cleaned) {
      setError('Informe um valor maior que zero')
      return
    }

    const parsed = Number(cleaned)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Informe um valor válido')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/dev/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parsed })
      })

      const payload = (await response.json().catch(() => null)) as EscrowCreationResponse | null

      if (!response.ok || !payload) {
        const message = (payload as any)?.error ?? 'Falha ao criar pedido'
        throw new Error(message)
      }

      setResult(payload)
      setFilterInput(payload.order.id)
      applyFilter(payload.order.id)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro inesperado'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="mb-8 space-y-6 bg-white/80 p-6 rounded-2xl border border-zinc-100 shadow-sm">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-zinc-800">Interação ativa com o Ventra</p>
        <p className="text-xs text-zinc-500">
          Crie um pedido sandbox real e acompanhe todos os webhooks que chegam para o mesmo order_id.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 md:flex-row md:items-end">
        <label className="flex-1 min-w-[160px]">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Amount (BRL)</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="Ex: 150"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {loading ? 'Criando pedido...' : 'Create test order'}
        </button>
      </form>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {result && (
        <div className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm text-zinc-800">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-zinc-500">order_id</p>
              <p className="font-mono text-sm break-all text-zinc-900">{result.order.id}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">charge_id</p>
              <p className="font-mono text-sm break-all text-zinc-900">{result.charge.id}</p>
            </div>
            <div className="text-right text-xs text-zinc-500">
              <div>Valor</div>
              <div className="font-semibold text-zinc-700">{formatCurrency(result.order.amount_cents)}</div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Status</p>
              <p className="font-semibold">{result.charge.status}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Expira em</p>
              <p className="font-semibold text-zinc-700">
                {new Date(result.charge.expires_at).toLocaleString()}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">PIX EMV (QRCode)</p>
              <pre className="mt-1 overflow-x-auto rounded bg-white p-2 text-xs leading-tight text-zinc-800">
                {result.charge.pix_emv}
              </pre>
            </div>
            <div className="sm:col-span-2">
              <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">TXID</p>
              <pre className="mt-1 rounded bg-white p-2 text-xs font-mono text-zinc-800">{result.charge.txid}</pre>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => applyFilter(result.order.id)}
              className="text-xs font-semibold uppercase tracking-wider text-blue-600"
            >
              Filtrar timeline por esse pedido
            </button>
            <p className="text-xs text-zinc-500">
              Eventos chegam automaticamente via webhooks depois que o pedido for criado e simulado.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">Filtro de timeline</p>
          {initialOrderFilter && (
            <span className="text-xs text-zinc-500">order_id atual: {initialOrderFilter}</span>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={filterInput}
            onChange={(event) => setFilterInput(event.target.value)}
            placeholder="Cole o order_id aqui"
            className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => applyFilter()}
              disabled={isPending}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-50"
            >
              Aplicar filtro
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterInput('')
                applyFilter('')
              }}
              disabled={isPending}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-700 disabled:opacity-40"
            >
              Limpar
            </button>
          </div>
        </div>
        <p className="text-xs text-zinc-500">
          {initialOrderFilter
            ? 'Mostrando eventos filtrados. Atualize o filtro para ver outro pedido.'
            : 'Sem filtro: mostra os últimos eventos recebidos pela VentraSim.'}
        </p>
      </div>
    </section>
  )
}
