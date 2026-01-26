'use client'

import { useEffect, useMemo, useState } from 'react'

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

export default function EventsListClient({ rows }: { rows: EventRow[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<DetailResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedId) return
    let isActive = true
    setLoading(true)
    setError(null)
    setDetail(null)

    fetch(`/api/events/${encodeURIComponent(selectedId)}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error('Falha ao carregar detalhes')
        }
        return res.json()
      })
      .then((data: DetailResponse) => {
        if (isActive) {
          setDetail(data)
        }
      })
      .catch((err) => {
        if (isActive) {
          setError(err instanceof Error ? err.message : 'Erro inesperado')
        }
      })
      .finally(() => {
        if (isActive) setLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [selectedId])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSelectedId(null)
      }
    }
    if (selectedId) {
      window.addEventListener('keydown', onKey)
      return () => window.removeEventListener('keydown', onKey)
    }
  }, [selectedId])

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

      {selectedId && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedId(null)} />
          <div className="absolute inset-y-0 right-0 w-full max-w-[420px] bg-white shadow-xl p-6 overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">
                  {detail?.event.eventType ?? 'Carregando...'}
                </h2>
                <div className="text-sm text-zinc-500">order_id: {detail?.event.orderId ?? '-'}</div>
                <div className="text-xs text-zinc-400 break-all">event_id: {selectedId}</div>
              </div>
              <button
                type="button"
                className="text-sm text-zinc-500 hover:text-zinc-700"
                onClick={() => setSelectedId(null)}
              >
                Fechar
              </button>
            </div>

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
                      <div key={d.id} className="border rounded p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span>Attempt #{d.attemptNumber}</span>
                          <span className="text-zinc-500">{d.status}</span>
                        </div>
                        <div className="text-xs text-zinc-500 mt-1">{d.receivedAt}</div>
                        {d.errorMessage && (
                          <div className="text-xs text-red-600 mt-1">{d.errorMessage}</div>
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
