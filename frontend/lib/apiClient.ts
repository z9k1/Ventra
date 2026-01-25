import { loadSettings } from './settings'

type RequestParams = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: Record<string, unknown>
  action?: string
  headers?: Record<string, string>
}

const sanitizePath = (path: string) => path.replace(/^\/+/, '')

const buildUrl = (path: string, useProxy: boolean, baseUrl: string) => {
  const trimmed = sanitizePath(path)
  if (useProxy) {
    return `/api/proxy/${trimmed}`
  }
  const base = baseUrl.replace(/\/+$/u, '')
  return `${base}/${trimmed}`
}

export async function apiRequest<T>(path: string, params: RequestParams = {}): Promise<T> {
  const settings = loadSettings()
  const url = buildUrl(path, settings.useProxy, settings.apiBaseUrl)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-API-KEY': settings.apiKey,
    ...params.headers
  }

  if (params.action) {
    const idempotencyKey = `web-${params.action}-${crypto.randomUUID()}`
    headers['Idempotency-Key'] = idempotencyKey
  }

  const response = await fetch(url, {
    method: params.method ?? 'GET',
    headers,
    ...(params.body ? { body: JSON.stringify(params.body) } : {})
  })

  const text = await response.text()
  const payload = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new Error(payload?.detail ?? response.statusText ?? 'Erro na requisição')
  }

  return payload as T
}
