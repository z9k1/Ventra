import { NextRequest, NextResponse } from 'next/server'
import { getEndpointConfig, updateEndpointMode } from '@/db/queries'

const allowedEnvs = ['local', 'sandbox', 'staging'] as const
type Env = (typeof allowedEnvs)[number]

export async function GET(request: NextRequest, { params }: { params: Promise<{ env: string }> }) {
  const { env } = await params
  const resolvedEnv = env as Env
  if (!allowedEnvs.includes(resolvedEnv)) {
    return NextResponse.json({ error: 'invalid_env' }, { status: 400 })
  }

  const config = await getEndpointConfig(resolvedEnv)
  if (!config) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json({
    env: resolvedEnv,
    mode: config.deliveryMode,
    timeoutMs: config.timeoutMs
  })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ env: string }> }) {
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
}
