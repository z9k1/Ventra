const webhookEnvs = ['local', 'sandbox', 'staging'] as const
export type WebhookEnv = (typeof webhookEnvs)[number]

export function isWebhookEnv(value: unknown): value is WebhookEnv {
  return typeof value === 'string' && webhookEnvs.includes(value as WebhookEnv)
}

type TimestampValue = Date | string

function formatTimestamp(value: TimestampValue) {
  return value instanceof Date ? value.toISOString() : value
}

export type WebhookEndpointRow = {
  id: number
  env: string
  url: string
  secret: string
  isActive: boolean
  deliveryMode: string
  timeoutMs: number
  createdAt: TimestampValue
  updatedAt: TimestampValue
}

export function serializeWebhookEndpoint(row: WebhookEndpointRow) {
  return {
    id: row.id,
    env: row.env,
    url: row.url,
    secret: row.secret,
    isActive: row.isActive,
    deliveryMode: row.deliveryMode,
    timeoutMs: row.timeoutMs,
    createdAt: formatTimestamp(row.createdAt),
    updatedAt: formatTimestamp(row.updatedAt)
  }
}
