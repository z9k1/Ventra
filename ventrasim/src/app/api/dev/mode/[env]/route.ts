import { NextRequest, NextResponse } from 'next/server'
import { upsertEndpointConfig, updateEndpointMode } from '@/db/queries'

export const runtime = 'nodejs'

const allowedEnvs = ['local', 'sandbox', 'staging'] as const
type Env = (typeof allowedEnvs)[number]

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ env: string }> }
) {
  try {
    const { env } = await params
    const resolvedEnv = env as Env

    if (!allowedEnvs.includes(resolvedEnv)) {
      return NextResponse.json({ error: 'invalid_env' }, { status: 400 })
    }

    const config = await upsertEndpointConfig(resolvedEnv)

    return NextResponse.json({
      env: resolvedEnv,
      mode: config.deliveryMode,
      timeoutMs: config.timeoutMs
    })
  } catch (error) {
    console.error('[GET /api/dev/mode] Error:', error)
    return NextResponse.json(
      { error: 'internal_server_error', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ env: string }> }
) {
  try {
    const { env } = await params
    const resolvedEnv = env as Env

    if (!allowedEnvs.includes(resolvedEnv)) {
      return NextResponse.json({ error: 'invalid_env' }, { status: 400 })
    }

    const body = await request.json()
    const { mode, timeoutMs } = body

    if (!['normal', 'offline', 'timeout'].includes(mode)) {
      return NextResponse.json({ error: 'invalid_mode' }, { status: 400 })
    }

    // Ensure it exists first
    await upsertEndpointConfig(resolvedEnv)

    await updateEndpointMode({
      env: resolvedEnv,
      deliveryMode: mode,
      timeoutMs: timeoutMs
    })

    return NextResponse.json({
      ok: true,
      env: resolvedEnv,
      mode,
      timeoutMs
    })
  } catch (error) {
    console.error('[POST /api/dev/mode] Error:', error)
    return NextResponse.json(
      { error: 'internal_server_error', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
