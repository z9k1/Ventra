import { createHmac } from 'crypto'

type EndpointForDelivery = {
  id: number | null
  url: string
  secret: string | null
}

export type DeliveryResult = {
  statusCode: number | null
  latencyMs: number
  errorMessage: string | null
}

export async function deliverToEndpoint(params: {
  endpoint: EndpointForDelivery
  env: string
  eventId: string
  rawBody: string
}): Promise<DeliveryResult> {
  const { endpoint, env, eventId, rawBody } = params
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-ventra-env': env,
    'x-event-id': eventId
  }

  if (endpoint.secret) {
    const signature = createHmac('sha256', endpoint.secret).update(rawBody).digest('hex')
    headers['x-signature'] = signature
  }

  const start = Date.now()
  let statusCode: number | null = null
  let errorMessage: string | null = null

  try {
    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers,
      body: rawBody
    })
    statusCode = response.status

    if (!response.ok) {
      const text = await response.text()
      errorMessage = text || response.statusText
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'delivery_failed'
  }

  const latencyMs = Date.now() - start
  return { statusCode, latencyMs, errorMessage }
}
