'use client'

import { useState } from 'react'

const ACTION_LABELS: Record<'release' | 'refund', string> = {
  release: 'Release funds',
  refund: 'Refund customer'
}

type OrderActionsProps = {
  orderId: string
}

export default function OrderActions({ orderId }: OrderActionsProps) {
  const [activeAction, setActiveAction] = useState<'release' | 'refund' | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const callAction = async (action: 'release' | 'refund') => {
    setFeedback(null)
    setError(null)
    setActiveAction(action)

    try {
      const response = await fetch(`/api/dev/orders/${orderId}/${action}`, {
        method: 'POST'
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        const message = (payload as any)?.error ?? 'Falha ao executar ação'
        throw new Error(message)
      }
      setFeedback(`${ACTION_LABELS[action]} requested`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro inesperado'
      setError(message)
    } finally {
      setActiveAction(null)
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">Actions</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={activeAction === 'release'}
          onClick={() => callAction('release')}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white disabled:opacity-50"
        >
          {activeAction === 'release' ? 'Sending...' : 'Release funds'}
        </button>
        <button
          type="button"
          disabled={activeAction === 'refund'}
          onClick={() => callAction('refund')}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-800 disabled:opacity-50"
        >
          {activeAction === 'refund' ? 'Sending...' : 'Refund customer'}
        </button>
      </div>
      {feedback && <p className="mt-2 text-xs text-emerald-700">{feedback}</p>}
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  )
}
