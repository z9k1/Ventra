import { NextResponse } from 'next/server'
import { asc, eq } from 'drizzle-orm'

import { db } from '@/db/index'
import { webhookEndpoints } from '@/db/schema'
import { isWebhookEnv, serializeWebhookEndpoint } from './utils'

type CreateBody = {
  env?: unknown
  url?: unknown
  secret?: unknown
  is_active?: unknown
}

function buildBadRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const env = url.searchParams.get('env')

  if (!env) {
    return buildBadRequest('env_required')
  }
  if (!isWebhookEnv(env)) {
    return buildBadRequest('invalid_env')
  }

  const rows = await db
    .select({
      id: webhookEndpoints.id,
      env: webhookEndpoints.env,
      url: webhookEndpoints.url,
      secret: webhookEndpoints.secret,
      isActive: webhookEndpoints.isActive,
      deliveryMode: webhookEndpoints.deliveryMode,
      timeoutMs: webhookEndpoints.timeoutMs,
      createdAt: webhookEndpoints.createdAt,
      updatedAt: webhookEndpoints.updatedAt
    })
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.env, env))
    .orderBy(asc(webhookEndpoints.createdAt))

  return NextResponse.json(rows.map(serializeWebhookEndpoint))
}

export async function POST(request: Request) {
  let body: CreateBody

  try {
    body = (await request.json()) as CreateBody
  } catch (error) {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const env = body.env
  const urlValue = typeof body.url === 'string' ? body.url.trim() : ''
  const secretValue = typeof body.secret === 'string' ? body.secret.trim() : ''
  const isActive = body.is_active === true

  if (!isWebhookEnv(env)) {
    return buildBadRequest('invalid_env')
  }
  if (!urlValue) {
    return buildBadRequest('url_required')
  }
  if (!secretValue) {
    return buildBadRequest('secret_required')
  }

  const now = new Date()

  const inserted = await db.transaction(async (tx) => {
    if (isActive) {
      await tx
        .update(webhookEndpoints)
        .set({
          isActive: false,
          updatedAt: now
        })
        .where(eq(webhookEndpoints.env, env))
    }

    const rows = await tx
      .insert(webhookEndpoints)
      .values({
        env,
        url: urlValue,
        secret: secretValue,
        isActive,
        createdAt: now,
        updatedAt: now
      })
      .returning({
        id: webhookEndpoints.id,
        env: webhookEndpoints.env,
        url: webhookEndpoints.url,
        secret: webhookEndpoints.secret,
        isActive: webhookEndpoints.isActive,
        deliveryMode: webhookEndpoints.deliveryMode,
        timeoutMs: webhookEndpoints.timeoutMs,
        createdAt: webhookEndpoints.createdAt,
        updatedAt: webhookEndpoints.updatedAt
      })

    return rows[0]
  })

  if (!inserted) {
    return NextResponse.json({ error: 'failed_to_create' }, { status: 500 })
  }

  return NextResponse.json(serializeWebhookEndpoint(inserted), { status: 201 })
}
