import { randomUUID } from 'crypto'

const baseUrlEnv = process.env.VENTRA_API_BASE_URL?.trim()
const apiKeyEnv = process.env.VENTRA_API_KEY?.trim()

export type VentraConnectionOverride = {
  baseUrl?: string
  apiKey?: string
}

type VentraConnection = {
  baseUrl: string
  apiKey: string
}

function resolveConnection(override?: VentraConnectionOverride): VentraConnection {
  const baseUrl = override?.baseUrl?.trim() || baseUrlEnv
  const apiKey = override?.apiKey?.trim() || apiKeyEnv

  if (!baseUrl) {
    throw new Error('VENTRA_API_BASE_URL is not configured')
  }

  if (!apiKey) {
    throw new Error('VENTRA_API_KEY is not configured')
  }

  return { baseUrl, apiKey }
}

const resolveUrl = (path: string, baseUrl: string) => {
  return new URL(path, baseUrl).toString()
}

type HttpMethod = 'GET' | 'POST'

type RequestOptions = {
  method?: HttpMethod
  body?: Record<string, unknown>
  idempotencyKey?: string
}

async function ventraRequest<T>(
  path: string,
  options: RequestOptions = {},
  override?: VentraConnectionOverride
) {
  const connection = resolveConnection(override)
  const url = resolveUrl(path, connection.baseUrl)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-API-KEY': connection.apiKey
  }

  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey
  }

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    ...(options.body ? { body: JSON.stringify(options.body) } : {})
  })

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
    const detail = (payload as any)?.detail ?? (payload as any)?.error
    const title = detail ?? response.statusText
    throw new Error(title ?? `Ventra request failed (${response.status})`)
  }

  return payload as T
}

export type VentraOrder = {
  id: string
  status: string
  amount_cents: number
  currency: string
  created_at: string
  updated_at: string
}

export type VentraCharge = {
  id: string
  order_id: string
  status: string
  expires_at: string
  pix_emv: string
  txid: string
}

export type CreateEscrowPayload = {
  order: VentraOrder
  charge: VentraCharge
}

export async function createEscrow(
  params: { amount_cents: number },
  override?: VentraConnectionOverride
) {
  if (!Number.isFinite(params.amount_cents) || params.amount_cents <= 0) {
    throw new Error('amount_cents must be a positive number')
  }

  const order = await ventraRequest<VentraOrder>('/orders', {
    method: 'POST',
    body: {
      amount_cents: params.amount_cents,
      currency: 'BRL'
    },
    idempotencyKey: `ventrasim-order-${randomUUID()}`
  }, override)

  const charge = await ventraRequest<VentraCharge>(`/orders/${order.id}/charges/pix`, {
    method: 'POST',
    idempotencyKey: `ventrasim-charge-${randomUUID()}`
  }, override)

  return { order, charge }
}

async function postOrderAction(
  orderId: string,
  action: 'release' | 'refund',
  override?: VentraConnectionOverride
) {
  if (!orderId) {
    throw new Error('orderId is required')
  }
  return ventraRequest(`/orders/${orderId}/${action}`, {
    method: 'POST',
    idempotencyKey: `ventrasim-${action}-${randomUUID()}`
  }, override)
}

export async function releaseOrder(orderId: string, override?: VentraConnectionOverride) {
  return postOrderAction(orderId, 'release', override)
}

export async function refundOrder(orderId: string, override?: VentraConnectionOverride) {
  return postOrderAction(orderId, 'refund', override)
}
