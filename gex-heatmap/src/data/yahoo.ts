import type { ChainSnapshot, OptionContract } from '../types'
import { bsGamma } from '../lib/blackScholes'
import { dte, timeToExpiryYears, toIsoDate } from '../lib/dates'

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

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function yahooSymbol(symbol: string): string {
  return INDEX_MAP[symbol] ?? symbol
}

function unixToIso(seconds: number): string {
  return toIsoDate(new Date(seconds * 1000))
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
    if (iv > 3) iv = iv / 100
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
  if (!response.ok) {
    throw new Error(`Yahoo Finance HTTP ${response.status}`)
  }
  return response.json()
}

function extractResult(payload: unknown): Record<string, unknown> {
  const root = asRecord(payload)
  const chain = asRecord(root?.optionChain)
  const error = asRecord(chain?.error)
  if (error && (error.description || error.code)) {
    throw new Error(String(error.description ?? error.code))
  }
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
    throw new Error('Yahoo Finance chain contained no option contracts')
  }

  const filtered = contracts.filter((c) => dte(c.expiration, now) >= -1)

  return {
    symbol,
    spot,
    asOf: now.toISOString(),
    source: 'yahoo',
    multiplier: 100,
    contracts: filtered,
  }
}
