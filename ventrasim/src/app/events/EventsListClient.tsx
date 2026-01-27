'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type EventRow = {
  id: string
  eventId: string
  eventType: string
  orderId: string
  signatureOk: boolean
  deltaMs: number | null
  receivedAt: string
  retryCount: number
}

type Delivery = {
  id: string
  eventId: string
  attemptNumber: number
  status: string
  errorMessage: string | null
  modeUsed: string | null
  latencyMs: number | null
  receivedAt: string
}

type EventDetail = {
  id: string
  eventId: string
  env: string
  eventType: string
  orderId: string
  signatureOk: boolean
  eventTimestamp: string | null
  receivedAt: string
  deltaMs: number | null
  payloadJson: unknown
  headersJson: Record<string, string>
}

type DetailResponse = {
  event: EventDetail
  deliveries: Delivery[]
  retryCount: number
  deltaSeconds: number | null
}

type RetryResponse = {
  ok: boolean
  attempt_number: number
  status_code: number | null
  latency_ms: number | null
  delivery_id: string | null
}

type RetryFeedback = { type: 'success' | 'error'; text: string }

async function retryWebhookDelivery(env: string, eventId: string) {
  const response = await fetch('/api/dev/webhooks/retry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ env, eventId })
  })

  const payload: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const detail =
      typeof payload === 'object' && payload !== null
        ? (payload as Record<string, unknown>).error ?? (payload as Record<string, unknown>).detail
        : null
    throw new Error(typeof detail === 'string' ? detail : 'Falha ao reenviar o delivery')
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error('Resposta inválida do retry')
  }

  return payload as RetryResponse
}

export default function EventsListClient({ rows }: { rows: EventRow[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<DetailResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryLoading, setRetryLoading] = useState(false)
  const [nextRetryAllowedAt, setNextRetryAllowedAt] = useState(0)
  const [retryFeedback, setRetryFeedback] = useState<RetryFeedback | null>(null)
  const requestIdRef = useRef(0)

  const loadDetail = useCallback(async (eventId: string) => {
    requestIdRef.current += 1
    const currentRequest = requestIdRef.current
    setLoading(true)
    setError(null)
    setDetail(null)

    try {
      const response = await fetch(`/api/events/${encodeURIComponent(eventId)}`)
      if (!response.ok) {
        throw new Error('Falha ao carregar detalhes')
      }
      const payload = (await response.json()) as DetailResponse
      if (currentRequest === requestIdRef.current) {
        setDetail(payload)
      }
    } catch (err) {
      if (currentRequest === requestIdRef.current) {
        setError(err instanceof Error ? err.message : 'Erro inesperado')
      }
    } finally {
      if (currentRequest === requestIdRef.current) {
        setLoading(false)
      }
    }
  }, [])

  const closeDrawer = useCallback(() => {
    requestIdRef.current += 1
    setSelectedId(null)
    setDetail(null)
    setError(null)
    setLoading(false)
    setRetryFeedback(null)
  }, [])

  const handleRetry = useCallback(async () => {
    if (!detail?.event.eventId || retryLoading) {
      return
    }
    if (Date.now() < nextRetryAllowedAt) {
      return
    }

    const env = detail.event.env ?? 'sandbox'
    const eventId = detail.event.eventId
    const cooldownUntil = Date.now() + 1500
    setNextRetryAllowedAt(cooldownUntil)
    setRetryLoading(true)
    setRetryFeedback(null)

    try {
      const payload = await retryWebhookDelivery(env, eventId)
      const statusText = payload.status_code ?? '—'
      const latencyText = payload.latency_ms ?? 0
      setRetryFeedback({
        type: 'success',
        text: `Retry sent — attempt #${payload.attempt_number} (status ${statusText}, Δ ${latencyText}ms)`
      })
      if (selectedId) {
        await loadDetail(selectedId)
      }
    } catch (err) {
      setRetryFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erro ao executar retry'
      })
    } finally {
      setRetryLoading(false)
    }
  }, [detail, loadDetail, nextRetryAllowedAt, retryLoading, selectedId])

  useEffect(() => {
    if (!selectedId) return
    loadDetail(selectedId)
  }, [selectedId, loadDetail])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeDrawer()
      }
    }
    if (selectedId) {
      window.addEventListener('keydown', onKey)
      return () => window.removeEventListener('keydown', onKey)
    }
  }, [selectedId, closeDrawer])

  useEffect(() => {
    if (!retryFeedback) return
    const timer = setTimeout(() => setRetryFeedback(null), 5000)
    return () => clearTimeout(timer)
  }, [retryFeedback])

  const detailBadges = useMemo(() => {
    if (!detail) return null
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`text-xs px-2 py-1 rounded ${
            detail.event.signatureOk ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}
        >
          {detail.event.signatureOk ? 'SIG OK' : 'SIG FAIL'}
        </span>
        <span className="text-xs px-2 py-1 rounded bg-zinc-100 text-zinc-700">
          RETRY {detail.retryCount}
        </span>
        {typeof detail.deltaSeconds === 'number' && (
          <span className="text-xs px-2 py-1 rounded bg-zinc-100 text-zinc-700">
            DELTA +{detail.deltaSeconds}s
          </span>
        )}
      </div>
    )
  }, [detail])

  const isCoolingDown = Date.now() < nextRetryAllowedAt
  const canRetry = !!detail?.event.eventId && !retryLoading && !isCoolingDown
  const retryButtonLabel = retryLoading ? 'Retrying...' : 'Retry delivery'

  return (
    <div className="space-y-3">
      {rows.map((e) => (
        <button
          type="button"
          key={e.id}
          className="w-full text-left rounded-md border p-4 flex items-center justify-between hover:border-zinc-300 transition"
          onClick={() => setSelectedId(e.eventId)}
        >
          <div>
            <div className="font-medium">{e.eventType}</div>
            <div className="text-sm text-zinc-500">order_id: {e.orderId ?? '-'}</div>
            <div className="text-xs text-zinc-400">event_id: {e.eventId}</div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2 py-1 rounded ${
                e.signatureOk ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}
            >
              {e.signatureOk ? 'SIG OK' : 'SIG FAIL'}
            </span>

            <span className="text-xs px-2 py-1 rounded bg-zinc-100 text-zinc-700">
              RETRY {e.retryCount}
            </span>

            {typeof e.deltaMs === 'number' && (
              <span className="text-xs px-2 py-1 rounded bg-zinc-100 text-zinc-700">
                DELTA +{Math.round(e.deltaMs / 1000)}s
              </span>
            )}
          </div>
        </button>
      ))}

      {rows.length === 0 && (
        <div className="rounded-md border border-dashed border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
          Nenhum evento encontrado para o filtro atual. Aguarde o webhook chegar ou limpe o filtro para ver toda a fila.
        </div>
      )}

      {selectedId && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={closeDrawer} />
          <div className="absolute inset-y-0 right-0 w-full max-w-[420px] bg-white shadow-xl p-6 overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">
                  {detail?.event.eventType ?? 'Carregando...'}
                </h2>
                <div className="text-sm text-zinc-500">order_id: {detail?.event.orderId ?? '-'}</div>
                <div className="text-xs text-zinc-400 break-all">event_id: {selectedId}</div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={!canRetry}
                  className={`rounded-full px-4 py-2 text-xs font-semibold tracking-[0.3em] transition uppercase border ${
                    canRetry ? 'border-zinc-900 bg-zinc-900 text-white hover:bg-black' : 'border-zinc-200 bg-zinc-100 text-zinc-500'
                  }`}
                >
                  {retryButtonLabel}
                </button>
                <button
                  type="button"
                  className="text-sm text-zinc-500 hover:text-zinc-700"
                  onClick={closeDrawer}
                >
                  Fechar
                </button>
              </div>
            </div>

            {retryFeedback && (
              <div
                className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${
                  retryFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    : 'bg-rose-50 text-rose-700 border border-rose-100'
                }`}
              >
                {retryFeedback.text}
              </div>
            )}

            <div className="mt-3">{detailBadges}</div>

            {loading && <div className="mt-6 text-sm text-zinc-500">Carregando detalhes...</div>}
            {error && <div className="mt-6 text-sm text-red-600">{error}</div>}

            {detail && (
              <div className="mt-6 space-y-6">
                <section>
                  <h3 className="text-sm font-semibold mb-2">Payload</h3>
                  <pre className="text-xs whitespace-pre-wrap bg-zinc-50 border rounded p-3">
                    {JSON.stringify(detail.event.payloadJson, null, 2)}
                  </pre>
                </section>

                <section>
                  <h3 className="text-sm font-semibold mb-2">Headers</h3>
                  <pre className="text-xs whitespace-pre-wrap bg-zinc-50 border rounded p-3">
                    {JSON.stringify(detail.event.headersJson, null, 2)}
                  </pre>
                </section>

                <section>
                  <h3 className="text-sm font-semibold mb-2">Timeline</h3>
                  <div className="space-y-2">
                    {detail.deliveries.map((d) => (
                      <div key={d.id} className="border rounded-lg p-4 text-sm bg-zinc-50/50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-zinc-700 text-xs uppercase tracking-tight">Attempt #{d.attemptNumber}</span>
                          <div className="flex items-center gap-2">
                            {d.modeUsed && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${
                                d.modeUsed === 'normal' ? 'bg-zinc-100 text-zinc-600 border-zinc-200' :
                                d.modeUsed === 'offline' ? 'bg-red-50 text-red-700 border-red-100' :
                                'bg-amber-50 text-amber-700 border-amber-100'
                              }`}>
                                {d.modeUsed.toUpperCase()}
                              </span>
                            )}
                            <span className={`font-mono font-bold ${d.status === '200' ? 'text-green-600' : 'text-red-600'}`}>
                              {d.status}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-zinc-400">
                          <span>{new Date(d.receivedAt).toLocaleString()}</span>
                          {typeof d.latencyMs === 'number' && (
                            <span className="font-medium text-zinc-500">{d.latencyMs}ms</span>
                          )}
                        </div>
                        {d.errorMessage && (
                          <div className="text-xs text-red-600 mt-2 p-2 bg-red-50 rounded border border-red-100 leading-relaxed">
                            {d.errorMessage}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
