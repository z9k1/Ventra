import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'
const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? 'dev-secret'

const normalizeHeaders = (headers: Headers) => {
  const result = new Headers()
  headers.forEach((value, key) => {
    if (key.toLowerCase() === 'host') return
    result.set(key, value)
  })
  return result
}

const buildTargetUrl = (params: { path?: string[] }, request: NextRequest) => {
  const segments = params.path ?? []
  const target = new URL(`${segments.join('/')}`, API_BASE_URL)
  target.search = request.nextUrl.search
  return target
}

const proxy = async (request: NextRequest, params: { path?: string[] }) => {
  const target = buildTargetUrl(params, request)
  const headers = normalizeHeaders(request.headers)
  headers.set('X-API-KEY', API_KEY)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const forwarded = await fetch(target, {
    method: request.method,
    headers,
    body: request.body
  })

  const responseHeaders = new Headers(forwarded.headers)
  responseHeaders.set('Access-Control-Allow-Origin', '*')

  const body = await forwarded.arrayBuffer()
  return new NextResponse(body, {
    status: forwarded.status,
    headers: responseHeaders
  })
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const DELETE = proxy
export const PATCH = proxy
export const OPTIONS = proxy
