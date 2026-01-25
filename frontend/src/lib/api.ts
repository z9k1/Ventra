import { loadSettings, isSettingsValid } from './settings'

export type ApiError = {
  message: string
  status?: number
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: Record<string, unknown>
  action?: string
  signal?: AbortSignal
}

const sanitize = (path: string) => path.replace(/^\/+/, '')

function randomId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return String(Date.now()) + '-' + Math.random().toString(16).slice(2)
}

export async function apiRequest<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  const settings = loadSettings()
  if (!isSettingsValid(settings)) {
    throw { message: 'API nao configurada. Ajuste em Settings.', status: 0 } satisfies ApiError
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-base-url': settings.apiBaseUrl,
    'x-api-key': settings.apiKey
  }

  if (options.action && (options.method ?? 'GET') !== 'GET') {
    headers['Idempotency-Key'] = `web-${options.action}-${randomId()}`
  }

  const response = await fetch(`/api/proxy/${sanitize(path)}`, {
    method: options.method ?? 'GET',
    headers,
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    signal: options.signal
  })

  const contentType = response.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')
  const payload = isJson ? await response.json().catch(() => null) : await response.text().catch(() => null)

  if (!response.ok) {
    const detail = typeof payload === 'object' && payload ? (payload as any).detail : undefined
    const message = detail || response.statusText || 'Erro na requisicao'
    throw { message, status: response.status } satisfies ApiError
  }

  return payload as T
}