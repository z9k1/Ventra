import { NextRequest, NextResponse } from 'next/server'

type Params = { path: string[] }

type HandlerContext = { params: Params }

function getHeader(request: NextRequest, name: string) {
  return request.headers.get(name) || request.headers.get(name.toLowerCase()) || ''
}

function sanitizeBaseUrl(baseUrl: string) {
  const trimmed = baseUrl.trim().replace(/\/+$/u, '')
  return trimmed || 'http://localhost:8000'
}

async function handler(request: NextRequest, context: HandlerContext) {
  const rawBaseUrl = getHeader(request, 'x-api-base-url') || 'http://localhost:8000'
  const apiKey = getHeader(request, 'x-api-key') || ''
  const baseUrl = sanitizeBaseUrl(rawBaseUrl)

  const target = new URL(`${context.params.path.join('/')}`, `${baseUrl}/`)
  target.search = request.nextUrl.search

  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.delete('x-api-base-url')
  headers.delete('x-api-key')

  headers.set('X-API-KEY', apiKey)

  const method = request.method.toUpperCase()
  const init: RequestInit = { method, headers }
  if (method !== 'GET' && method !== 'HEAD') {
    // NextRequest.body is a ReadableStream; passing it through to fetch() in Node
    // can require `duplex`, and errors surface as 500s. Buffer the body instead.
    const buf = await request.arrayBuffer()
    if (buf.byteLength > 0) init.body = new Uint8Array(buf)
  }

  const forwarded = await fetch(target, init)

  const responseHeaders = new Headers()
  const contentType = forwarded.headers.get('content-type')
  if (contentType) responseHeaders.set('content-type', contentType)

  const body = await forwarded.arrayBuffer()
  return new NextResponse(body, { status: forwarded.status, headers: responseHeaders })
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
