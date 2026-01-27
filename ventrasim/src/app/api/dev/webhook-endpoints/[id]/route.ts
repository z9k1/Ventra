import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'

import { db } from '@/db/index'
import { webhookEndpoints } from '@/db/schema'
import { isWebhookEnv, serializeWebhookEndpoint } from '../utils'

type PatchBody = {
  url?: unknown
  secret?: unknown
  is_active?: unknown
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const parsedId = Number(id)

  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    return badRequest('invalid_id')
  }

  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (!body || typeof body !== 'object') {
    return badRequest('invalid_body')
  }

  const trimmedUrl = typeof body.url === 'string' ? body.url.trim() : undefined
  const trimmedSecret = typeof body.secret === 'string' ? body.secret.trim() : undefined
  const isActiveValue = body.is_active

  if (body.url !== undefined && !trimmedUrl) {
    return badRequest('url_required')
  }
  if (body.secret !== undefined && !trimmedSecret) {
    return badRequest('secret_required')
  }
  if (isActiveValue !== undefined && typeof isActiveValue !== 'boolean') {
    return badRequest('is_active_boolean')
  }
  if (trimmedUrl === undefined && trimmedSecret === undefined && isActiveValue === undefined) {
    return badRequest('nothing_to_update')
  }

  const rows = await db
    .select({ env: webhookEndpoints.env })
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.id, parsedId))
    .limit(1)

  const existing = rows[0]
  if (!existing) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const env = existing.env
  if (!isWebhookEnv(env)) {
    return NextResponse.json({ error: 'invalid_env_in_db' }, { status: 500 })
  }

  const now = new Date()
  const shouldActivate = isActiveValue === true

  const updatePayload: Record<string, unknown> = {
    updatedAt: now
  }

  if (trimmedUrl !== undefined) {
    updatePayload.url = trimmedUrl
  }
  if (trimmedSecret !== undefined) {
    updatePayload.secret = trimmedSecret
  }
  if (isActiveValue !== undefined) {
    updatePayload.isActive = isActiveValue
  }

  const updated = await db.transaction(async (tx) => {
    if (shouldActivate) {
      await tx
        .update(webhookEndpoints)
        .set({
          isActive: false,
          updatedAt: now
        })
        .where(eq(webhookEndpoints.env, env))
    }

    const rows = await tx
      .update(webhookEndpoints)
      .set(updatePayload)
      .where(eq(webhookEndpoints.id, parsedId))
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

  if (!updated) {
    return NextResponse.json({ error: 'failed_to_update' }, { status: 500 })
  }

  return NextResponse.json(serializeWebhookEndpoint(updated))
}
