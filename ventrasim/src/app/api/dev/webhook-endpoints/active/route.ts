import { NextResponse } from 'next/server'

import { getEndpointConfig } from '@/db/queries'
import { isWebhookEnv } from '../utils'

const INTERNAL_HEADER = 'x-internal-token'
const INTERNAL_TOKEN = process.env.VENTRA_INTERNAL_TOKEN

function buildUnauthorizedResponse() {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
}

function buildInvalidEnvResponse() {
  return NextResponse.json({ error: 'invalid_env' }, { status: 400 })
}

function buildNotFoundResponse() {
  return NextResponse.json({ error: 'no_active_endpoint' }, { status: 404 })
}

export async function GET(request: Request) {
  const headerToken = request.headers.get(INTERNAL_HEADER)
  if (!INTERNAL_TOKEN || headerToken !== INTERNAL_TOKEN) {
    return buildUnauthorizedResponse()
  }

  const url = new URL(request.url)
  const env = url.searchParams.get('env')
  if (!isWebhookEnv(env)) {
    return buildInvalidEnvResponse()
  }

  const endpoint = await getEndpointConfig(env)
  if (!endpoint) {
    return buildNotFoundResponse()
  }

  const updatedAt =
    endpoint.updatedAt instanceof Date ? endpoint.updatedAt.toISOString() : endpoint.updatedAt

  return NextResponse.json({
    env,
    id: endpoint.id,
    url: endpoint.url,
    secret: endpoint.secret,
    updatedAt
  })
}
