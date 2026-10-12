// A tiny request/response shape shared by the Vercel functions and the Vite
// dev server, so the same handlers run in both. Both hand us Node req/res.
import type { IncomingMessage, ServerResponse } from 'node:http'

export interface ApiRequest {
  method: string
  query: URLSearchParams
  cookies: Record<string, string>
  /** e.g. "https://daily-briefing.vercel.app" */
  origin: string
}

export interface ApiResponse {
  status: number
  json?: unknown
  text?: string
  redirect?: string
  cookies?: string[]
}

export type Handler = (req: ApiRequest) => Promise<ApiResponse>

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

export function cookie(name: string, value: string, maxAgeSeconds: number, path = '/api/google'): string {
  return `${name}=${encodeURIComponent(value)}; Path=${path}; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`
}

export async function runNode(handler: Handler, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const host = req.headers['x-forwarded-host'] ?? req.headers.host ?? 'localhost'
  const forwarded = req.headers['x-forwarded-proto']
  const proto = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0] ?? (/^(localhost|127\.)/.test(String(host)) ? 'http' : 'https')
  const origin = `${proto}://${host}`
  const url = new URL(req.url ?? '/', origin)
  let out: ApiResponse
  try {
    out = await handler({ method: req.method ?? 'GET', query: url.searchParams, cookies: parseCookies(req.headers.cookie), origin })
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500
    out = { status, json: { error: err instanceof HttpError ? err.message : 'Something went wrong' } }
    if (!(err instanceof HttpError)) console.error(err)
  }
  res.setHeader('Cache-Control', 'no-store')
  if (out.cookies?.length) res.setHeader('Set-Cookie', out.cookies)
  if (out.redirect) {
    res.statusCode = 302
    res.setHeader('Location', out.redirect)
    res.end()
    return
  }
  res.statusCode = out.status
  if (out.text != null) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end(out.text)
  } else {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(out.json ?? {}))
  }
}
