'use client'

import { useEffect, useState, type FormEvent } from 'react'

import { DEFAULT_VENTRA_SETTINGS, loadVentraSettings, saveVentraSettings } from '@/lib/ventraSettings'

export default function VentraConnectionCard() {
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_VENTRA_SETTINGS.apiBaseUrl)
  const [apiKey, setApiKey] = useState(DEFAULT_VENTRA_SETTINGS.apiKey)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const saved = loadVentraSettings()
    setApiBaseUrl(saved.apiBaseUrl)
    setApiKey(saved.apiKey)
  }, [])

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus(null)
    setError(null)

    const trimmedBaseUrl = apiBaseUrl.trim()
    const trimmedKey = apiKey.trim()

    try {
      new URL(trimmedBaseUrl)
    } catch {
      setError('Informe uma URL valida para o Ventra.')
      return
    }

    if (!trimmedKey) {
      setError('Informe a API key do Ventra.')
      return
    }

    saveVentraSettings({ apiBaseUrl: trimmedBaseUrl, apiKey: trimmedKey })
    setStatus('Configuracao salva. As proximas chamadas vao usar essa API key.')
  }

  return (
    <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500">Conexao com Ventra</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Esses dados sao enviados nas chamadas /api/dev como headers (x-api-base-url e x-api-key).
        </p>
      </div>

      <form onSubmit={handleSave} className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          API Base URL
          <input
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
            value={apiBaseUrl}
            onChange={(event) => setApiBaseUrl(event.target.value)}
            placeholder="http://localhost:8000"
          />
        </label>
        <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          API Key
          <input
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="dev-secret"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white"
        >
          Salvar
        </button>
      </form>

      {status && <p className="mt-3 text-xs text-emerald-700">{status}</p>}
      {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}
    </section>
  )
}
