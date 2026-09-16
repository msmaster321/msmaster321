import type { ChainSnapshot, OptionContract } from '../types'
import { bsGamma } from '../lib/blackScholes'
import { dte, timeToExpiryYears } from '../lib/dates'

const INDEX_MAP: Record<string, string> = {
  SPX: '^SPX',
  NDX: '^NDX',
  RUT: '^RUT',
  VIX: '^VIX',
  DJX: '^DJX',
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function yahooSymbol(symbol: string): string {
  return INDEX_MAP[symbol] ?? symbol
}

function unixToIso(seconds: number): string {
  const date = new Date(seconds * 1000)
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function nestedError(payload: unknown): string | null {
  const root = asRecord(payload)
  if (!root) return null
  if (asString(root.error)) return asString(root.error)
  const finance = asRecord(root.finance)
  const chain = asRecord(root.optionChain)
  const error = asRecord(finance?.error) ?? asRecord(chain?.error)
  if (!error) return null
  return asString(error.description) ?? asString(error.code)
}

function failureMessage(status: number, text: string, payload: unknown): string {
  const nested = nestedError(payload)
  if (nested) return `Yahoo Finance: ${nested}`
  if (status === 401) return 'Yahoo Finance rejected the request (unauthorized crumb/cookie)'
  if (status === 429) return 'Yahoo Finance rate-limited the options request'
  if (status === 404) return 'Yahoo Finance has no options chain for this symbol'
  const snippet = text.replace(/\s+/g, ' ').slice(0, 140)
  return `Yahoo Finance HTTP ${status}${snippet ? `: ${snippet}` : ''}`
}

function parseContracts(
  rows: unknown[],
  right: 'call' | 'put',
  expiration: string,
  spot: number,
  now: Date,
): OptionContract[] {
  const t = timeToExpiryYears(expiration, now)
  const out: OptionContract[] = []
  for (const row of rows) {
    const rec = asRecord(row)
    if (!rec) continue
    const strike = asNumber(rec.strike)
    if (strike == null) continue
    const oi = asNumber(rec.openInterest) ?? 0
    let iv = asNumber(rec.impliedVolatility) ?? 0
    if (iv > 5) iv = iv / 100
    if (iv <= 0) iv = 0.2
    const gamma = asNumber(rec.gamma) ?? bsGamma(spot, strike, t, iv)
    out.push({
      expiration,
      strike,
      right,
      openInterest: Math.max(0, oi),
      impliedVolatility: iv,
      gamma,
    })
  }
  return out
}

async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal })
  const text = await response.text()
  let payload: unknown = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = null
  }
  if (!response.ok) {
    throw new Error(failureMessage(response.status, text, payload))
  }
  return payload
}

function extractResult(payload: unknown): Record<string, unknown> {
  const nested = nestedError(payload)
  if (nested) throw new Error(`Yahoo Finance: ${nested}`)
  const root = asRecord(payload)
  const chain = asRecord(root?.optionChain)
  const result = asArray(chain?.result)[0]
  const rec = asRecord(result)
  if (!rec) throw new Error('Yahoo Finance returned an empty options chain')
  return rec
}

export async function fetchYahooChain(
  symbolRaw: string,
  signal: AbortSignal,
  now = new Date(),
): Promise<ChainSnapshot> {
  const symbol = symbolRaw.trim().toUpperCase() || 'SPY'
  const mapped = encodeURIComponent(yahooSymbol(symbol))
  const first = extractResult(
    await fetchJson(`/api/yahoo/v7/finance/options/${mapped}`, signal),
  )
  const quote = asRecord(first.quote) ?? {}
  const spot =
    asNumber(quote.regularMarketPrice) ??
    asNumber(quote.postMarketPrice) ??
    asNumber(quote.preMarketPrice)
  if (spot == null) throw new Error('Yahoo Finance quote is missing a last price')

  const expirationUnix = asArray(first.expirationDates)
    .map(asNumber)
    .filter((n): n is number => n != null)
    .slice(0, 8)

  const contracts: OptionContract[] = []
  const seen = new Set<string>()

  const ingest = (payload: Record<string, unknown>) => {
    const optionBlocks = asArray(payload.options)
    for (const block of optionBlocks) {
      const rec = asRecord(block)
      if (!rec) continue
      const expUnix = asNumber(rec.expirationDate)
      const expiration = expUnix != null ? unixToIso(expUnix) : null
      if (!expiration) continue
      seen.add(String(expUnix))
      contracts.push(
        ...parseContracts(asArray(rec.calls), 'call', expiration, spot, now),
        ...parseContracts(asArray(rec.puts), 'put', expiration, spot, now),
      )
    }
  }

  ingest(first)

  const remaining = expirationUnix.filter((ts) => !seen.has(String(ts)))
  const chunks: number[][] = []
  for (let i = 0; i < remaining.length; i += 3) {
    chunks.push(remaining.slice(i, i + 3))
  }
  for (const chunk of chunks) {
    const parts = await Promise.all(
      chunk.map((ts) =>
        fetchJson(`/api/yahoo/v7/finance/options/${mapped}?date=${ts}`, signal).then(
          extractResult,
        ),
      ),
    )
    for (const part of parts) ingest(part)
  }

  if (contracts.length === 0) {
    throw new Error(`Yahoo Finance chain for ${symbol} contained no option contracts`)
  }

  const filtered = contracts.filter((c) => dte(c.expiration, now) >= -1)
  if (filtered.length === 0) {
    throw new Error(`Yahoo Finance chain for ${symbol} has no current or upcoming expirations`)
  }

  const marketTime = asNumber(quote.regularMarketTime)
  return {
    symbol,
    spot,
    asOf: marketTime != null ? new Date(marketTime * 1000).toISOString() : now.toISOString(),
    source: 'yahoo',
    multiplier: 100,
    contracts: filtered,
  }
}
