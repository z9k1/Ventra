'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

type WebhookEnv = 'local' | 'sandbox' | 'staging'

const envOptions: { value: WebhookEnv; label: string }[] = [
  { value: 'local', label: 'Local' },
  { value: 'sandbox', label: 'Sandbox' },
  { value: 'staging', label: 'Staging' }
]

type WebhookEndpoint = {
  id: number
  env: string
  url: string
  secret: string
  isActive: boolean
  deliveryMode: string
  timeoutMs: number
  createdAt: string
  updatedAt: string
}

type Feedback = { type: 'success' | 'error'; text: string }
type ModalState =
  | { mode: 'create'; env: WebhookEnv }
  | { mode: 'edit'; endpoint: WebhookEndpoint }

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'medium',
  timeStyle: 'short'
})

function formatTimestamp(value: string | null | undefined) {
  if (!value) return '-'
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) {
    return value
  }
  return dateFormatter.format(parsed)
}

async function parseApiResponse<T>(response: Response) {
  const text = await response.text()
  let payload: unknown = null

  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = text
    }
  }

  if (!response.ok) {
    const detail =
      typeof payload === 'object' && payload !== null
        ? (payload as Record<string, unknown>)['error'] ?? (payload as Record<string, unknown>)['detail']
        : null
    throw new Error(detail && typeof detail === 'string' ? detail : `Erro ${response.status}`)
  }

  return payload as T
}

async function fetchEndpoints(env: WebhookEnv) {
  const response = await fetch(`/api/dev/webhook-endpoints?env=${env}`, { cache: 'no-store' })
  return parseApiResponse<WebhookEndpoint[]>(response)
}

async function createEndpoint(payload: {
  env: WebhookEnv
  url: string
  secret: string
  is_active: boolean
}) {
  const response = await fetch('/api/dev/webhook-endpoints', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  return parseApiResponse<WebhookEndpoint>(response)
}

async function updateEndpoint(
  id: number,
  payload: { url?: string; secret?: string; is_active?: boolean }
) {
  const response = await fetch(`/api/dev/webhook-endpoints/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  return parseApiResponse<WebhookEndpoint>(response)
}

const badgeClasses = {
  success: 'bg-emerald-50 text-emerald-700',
  muted: 'bg-zinc-100 text-zinc-600'
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3 py-6"
      aria-modal="true"
      role="dialog"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-500 transition hover:bg-zinc-50"
          >
            ✕
          </button>
        </header>
        <div className="mt-6 space-y-4">{children}</div>
      </div>
    </div>
  )
}

export default function WebhooksSettingsPage() {
  const [activeEnv, setActiveEnv] = useState<WebhookEnv>('local')
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [modalState, setModalState] = useState<ModalState | null>(null)
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  const loadEndpoints = useCallback(async () => {
    setLoading(true)
    setListError(null)
    try {
      const rows = await fetchEndpoints(activeEnv)
      setEndpoints(rows)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao carregar endpoints.'
      setListError(message)
      setEndpoints([])
    } finally {
      setLoading(false)
    }
  }, [activeEnv])

  useEffect(() => {
    loadEndpoints()
  }, [loadEndpoints])

  useEffect(() => {
    if (!feedback) return
    const timer = setTimeout(() => setFeedback(null), 5000)
    return () => clearTimeout(timer)
  }, [feedback])

  const handleCreate = useCallback(
    async (payload: { env: WebhookEnv; url: string; secret: string; is_active: boolean }) => {
      await createEndpoint(payload)
      setFeedback({ type: 'success', text: 'Endpoint criado.' })
      await loadEndpoints()
    },
    [loadEndpoints]
  )

  const handleEdit = useCallback(
    async (id: number, payload: { url?: string; secret?: string; is_active?: boolean }) => {
      await updateEndpoint(id, payload)
      setFeedback({ type: 'success', text: 'Endpoint atualizado.' })
      await loadEndpoints()
    },
    [loadEndpoints]
  )

  const handleSetActive = useCallback(
    async (endpoint: WebhookEndpoint) => {
      setActionLoading(endpoint.id)
      try {
        await updateEndpoint(endpoint.id, { is_active: true })
        setFeedback({ type: 'success', text: 'Endpoint definido como ativo.' })
        await loadEndpoints()
      } catch (error) {
        const text = error instanceof Error ? error.message : 'Não foi possível ativar o endpoint.'
        setFeedback({ type: 'error', text })
      } finally {
        setActionLoading(null)
      }
    },
    [loadEndpoints]
  )

  const openCreateModal = () => setModalState({ mode: 'create', env: activeEnv })
  const openEditModal = (endpoint: WebhookEndpoint) => setModalState({ mode: 'edit', endpoint })
  const closeModal = () => setModalState(null)

  const activeEnvLabel = useMemo(() => {
    return envOptions.find((item) => item.value === activeEnv)?.label ?? activeEnv
  }, [activeEnv])

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold text-zinc-900">Webhook endpoints</h1>
        <p className="text-sm text-zinc-500">Gerencie os endpoints utilizados pelos webhooks do VentraSim.</p>
      </header>

      <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {envOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setActiveEnv(option.value)}
                className={cn(
                  'rounded-full border px-4 py-2 text-sm font-semibold transition',
                  activeEnv === option.value
                    ? 'border-zinc-900 bg-black text-white'
                    : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-400'
                )}
                aria-pressed={activeEnv === option.value}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-white"
          >
            Add endpoint
          </button>
        </div>
        <div className="text-xs uppercase tracking-[0.3em] text-zinc-400">ambiente ativo: {activeEnvLabel}</div>

        {feedback && (
          <div
            className={cn(
              'flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold',
              feedback.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            )}
          >
            <span>{feedback.text}</span>
            <button onClick={() => setFeedback(null)} type="button" className="text-xs opacity-60">
              fechar
            </button>
          </div>
        )}

        {listError && (
          <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {listError}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-4 py-3">Url</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Atualizado em</th>
                <th className="px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-zinc-500">
                    carregando endpoints do "{activeEnv}"...
                  </td>
                </tr>
              )}

              {!loading && endpoints.length === 0 && !listError && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-zinc-500">
                    Nenhum endpoint registrado para o ambiente {activeEnvLabel}.
                  </td>
                </tr>
              )}

              {!loading &&
                endpoints.map((endpoint) => (
                  <tr key={endpoint.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold text-zinc-900">{endpoint.url}</div>
                      <div className="text-[10px] uppercase tracking-[0.4em] text-zinc-400">{endpoint.deliveryMode}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase',
                          endpoint.isActive ? badgeClasses.success : badgeClasses.muted
                        )}
                      >
                        {endpoint.isActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-500">
                      {formatTimestamp(endpoint.updatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(endpoint)}
                          className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetActive(endpoint)}
                          disabled={endpoint.isActive || actionLoading === endpoint.id}
                          className={cn(
                            'rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] transition focus-visible:outline-none',
                            endpoint.isActive
                              ? 'border-zinc-200 bg-zinc-50 text-zinc-400'
                              : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400',
                            actionLoading === endpoint.id && 'opacity-60'
                          )}
                        >
                          {actionLoading === endpoint.id ? 'Ativando...' : 'Set Active'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {modalState?.mode === 'create' && (
        <ModalShell title="Add webhook endpoint" onClose={closeModal}>
          <CreateEndpointForm
            defaultEnv={modalState.env}
            onClose={closeModal}
            onSubmit={handleCreate}
          />
        </ModalShell>
      )}

      {modalState?.mode === 'edit' && modalState.endpoint && (
        <ModalShell title="Edit webhook endpoint" onClose={closeModal}>
          <EditEndpointForm endpoint={modalState.endpoint} onClose={closeModal} onSubmit={handleEdit} />
        </ModalShell>
      )}
    </main>
  )
}

function CreateEndpointForm({
  defaultEnv,
  onClose,
  onSubmit
}: {
  defaultEnv: WebhookEnv
  onClose: () => void
  onSubmit: (payload: { env: WebhookEnv; url: string; secret: string; is_active: boolean }) => Promise<void>
}) {
  const [env, setEnv] = useState<WebhookEnv>(defaultEnv)
  const [url, setUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [isActive, setIsActive] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!url.trim() || !secret.trim()) {
      setFormError('URL e secret são obrigatórios.')
      return
    }

    setFormError(null)
    setSubmitting(true)
    try {
      await onSubmit({ env, url: url.trim(), secret: secret.trim(), is_active: isActive })
      onClose()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Falha ao criar endpoint.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1 text-sm font-semibold text-zinc-700">
        <label htmlFor="env">Ambiente</label>
        <select
          id="env"
          value={env}
          onChange={(event) => setEnv(event.target.value as WebhookEnv)}
          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600"
        >
          {envOptions.map((option) => (
            <option value={option.value} key={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1 text-sm font-semibold text-zinc-700">
        <label htmlFor="url">URL</label>
        <input
          id="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
          placeholder="https://example.com/webhook"
        />
      </div>

      <div className="space-y-1 text-sm font-semibold text-zinc-700">
        <label htmlFor="secret">Secret</label>
        <input
          id="secret"
          value={secret}
          onChange={(event) => setSecret(event.target.value)}
          className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
          placeholder="secret-token"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-600">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
          className="h-4 w-4 rounded border border-zinc-300 text-zinc-900"
        />
        Tornar este endpoint ativo
      </label>

      {formError && <p className="text-xs font-semibold text-rose-600">{formError}</p>}

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className={cn(
            'rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white',
            submitting ? 'bg-zinc-400' : 'bg-zinc-900'
          )}
        >
          {submitting ? 'saving...' : 'Save'}
        </button>
      </div>
    </form>
  )
}

function EditEndpointForm({
  endpoint,
  onClose,
  onSubmit
}: {
  endpoint: WebhookEndpoint
  onClose: () => void
  onSubmit: (payload: { url?: string; secret?: string; is_active?: boolean }) => Promise<void>
}) {
  const [url, setUrl] = useState(endpoint.url)
  const [secret, setSecret] = useState(endpoint.secret)
  const [isActive, setIsActive] = useState(endpoint.isActive)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!url.trim() || !secret.trim()) {
      setFormError('URL e secret são obrigatórios.')
      return
    }

    setFormError(null)
    setSubmitting(true)
    try {
      await onSubmit({ url: url.trim(), secret: secret.trim(), is_active: isActive })
      onClose()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Falha ao atualizar endpoint.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1 text-sm font-semibold text-zinc-700">
        <p className="text-xs uppercase tracking-[0.4em] text-zinc-400">Ambiente</p>
        <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
          {endpoint.env}
        </p>
      </div>

      <div className="space-y-1 text-sm font-semibold text-zinc-700">
        <label htmlFor="edit-url">URL</label>
        <input
          id="edit-url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
        />
      </div>

      <div className="space-y-1 text-sm font-semibold text-zinc-700">
        <label htmlFor="edit-secret">Secret</label>
        <input
          id="edit-secret"
          value={secret}
          onChange={(event) => setSecret(event.target.value)}
          className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-600">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
          className="h-4 w-4 rounded border border-zinc-300 text-zinc-900"
        />
        Tornar este endpoint ativo
      </label>

      {formError && <p className="text-xs font-semibold text-rose-600">{formError}</p>}

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className={cn(
            'rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white',
            submitting ? 'bg-zinc-400' : 'bg-zinc-900'
          )}
        >
          {submitting ? 'saving...' : 'Save'}
        </button>
      </div>
    </form>
  )
}
