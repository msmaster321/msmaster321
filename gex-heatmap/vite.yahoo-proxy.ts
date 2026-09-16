import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const PREFIX = '/api/yahoo'
const UPSTREAM = 'https://query1.finance.yahoo.com'
const SESSION_TTL_MS = 12 * 60_000

interface YahooSession {
  cookie: string
  crumb: string
  createdAt: number
}

let session: YahooSession | null = null
let bootstrap: Promise<YahooSession> | null = null

function absorbCookies(jar: Map<string, string>, response: Response) {
  const header = response.headers as Headers & { getSetCookie?: () => string[] }
  const raw = header.getSetCookie?.() ?? []
  for (const cookie of raw) {
    const part = cookie.split(';')[0]
    if (!part) continue
    const eq = part.indexOf('=')
    if (eq <= 0) continue
    jar.set(part.slice(0, eq), part.slice(eq + 1))
  }
}

function cookieHeader(jar: Map<string, string>): string {
  return [...jar.entries()].map(([key, value]) => `${key}=${value}`).join('; ')
}

async function createSession(): Promise<YahooSession> {
  const jar = new Map<string, string>()
  const fc = await fetch('https://fc.yahoo.com/', {
    headers: { 'User-Agent': UA, Accept: '*/*' },
    redirect: 'manual',
  })
  absorbCookies(jar, fc)

  if (!jar.has('A3')) {
    const home = await fetch('https://finance.yahoo.com/', {
      headers: { 'User-Agent': UA, Accept: 'text/html', Cookie: cookieHeader(jar) },
    })
    absorbCookies(jar, home)
  }

  const crumbRes = await fetch(`${UPSTREAM}/v1/test/getcrumb`, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/plain',
      Cookie: cookieHeader(jar),
    },
  })
  absorbCookies(jar, crumbRes)
  const crumb = (await crumbRes.text()).trim()
  if (!crumbRes.ok || !crumb || crumb.startsWith('{') || crumb.includes(' ')) {
    throw new Error('Yahoo Finance crumb is unavailable (cookie handshake failed)')
  }

  return { cookie: cookieHeader(jar), crumb, createdAt: Date.now() }
}

function getSession(force = false): Promise<YahooSession> {
  if (!force && session && Date.now() - session.createdAt < SESSION_TTL_MS) {
    return Promise.resolve(session)
  }
  if (!force && bootstrap) return bootstrap
  bootstrap = createSession()
    .then((next) => {
      session = next
      return next
    })
    .catch((error: unknown) => {
      session = null
      throw error
    })
    .finally(() => {
      bootstrap = null
    })
  return bootstrap
}

function requestPath(req: IncomingMessage): string {
  return req.url ?? '/'
}

async function proxyYahoo(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const incoming = new URL(requestPath(req), 'http://localhost')
  const upstream = new URL(incoming.pathname.slice(PREFIX.length) + incoming.search, UPSTREAM)

  const send = async (forceRefresh: boolean): Promise<Response> => {
    const auth = await getSession(forceRefresh)
    upstream.searchParams.set('crumb', auth.crumb)
    return fetch(upstream, {
      headers: {
        'User-Agent': UA,
        Accept: 'application/json',
        Cookie: auth.cookie,
      },
    })
  }

  let upstreamRes = await send(false)
  if (upstreamRes.status === 401) {
    session = null
    upstreamRes = await send(true)
  }

  const body = Buffer.from(await upstreamRes.arrayBuffer())
  res.statusCode = upstreamRes.status
  res.setHeader('Content-Type', upstreamRes.headers.get('content-type') ?? 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(body)
}

function yahooMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
): void {
  const url = req.url ?? ''
  if (!url.startsWith(PREFIX)) {
    next()
    return
  }
  if (req.method && req.method !== 'GET') {
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Yahoo proxy only accepts GET' }))
    return
  }

  void proxyYahoo(req, res).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Yahoo proxy failed'
    if (!res.headersSent) {
      res.statusCode = 502
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: message }))
    }
  })
}

function attach(server: { middlewares: { use: (fn: typeof yahooMiddleware) => void } }) {
  server.middlewares.use(yahooMiddleware)
}

export function yahooOptionsProxy(): Plugin {
  return {
    name: 'yahoo-options-proxy',
    configureServer: attach,
    configurePreviewServer: attach,
  }
}
