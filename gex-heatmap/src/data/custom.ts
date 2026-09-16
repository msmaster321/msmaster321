import type { ChainSnapshot, OptionContract, OptionRight } from '../types'
import { bsGamma } from '../lib/blackScholes'
import { timeToExpiryYears } from '../lib/dates'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function asRight(value: unknown): OptionRight | null {
  if (value === 'call' || value === 'put') return value
  if (value === 'C' || value === 'c') return 'call'
  if (value === 'P' || value === 'p') return 'put'
  return null
}

export async function fetchCustomChain(
  baseUrl: string,
  symbolRaw: string,
  signal: AbortSignal,
  now = new Date(),
): Promise<ChainSnapshot> {
  const symbol = symbolRaw.trim().toUpperCase() || 'SPY'
  const url = new URL(baseUrl, window.location.origin)
  url.searchParams.set('symbol', symbol)
  const response = await fetch(url.toString(), { signal })
  if (!response.ok) throw new Error(`Custom options API HTTP ${response.status}`)
  const payload = asRecord(await response.json())
  if (!payload) throw new Error('Custom options API returned non-object JSON')

  const spot = asNumber(payload.spot)
  if (spot == null) throw new Error('Custom options API is missing spot')

  const rows = Array.isArray(payload.contracts) ? payload.contracts : []
  const contracts: OptionContract[] = []
  for (const row of rows) {
    const rec = asRecord(row)
    if (!rec) continue
    const expiration = asString(rec.expiration)
    const strike = asNumber(rec.strike)
    const right = asRight(rec.type ?? rec.right)
    const oi = asNumber(rec.openInterest) ?? 0
    let iv = asNumber(rec.impliedVolatility) ?? 0.2
    if (iv > 3) iv = iv / 100
    if (!expiration || strike == null || !right) continue
    const t = timeToExpiryYears(expiration, now)
    const gamma = asNumber(rec.gamma) ?? bsGamma(spot, strike, t, iv)
    contracts.push({
      expiration,
      strike,
      right,
      openInterest: Math.max(0, oi),
      impliedVolatility: iv,
      gamma,
    })
  }

  if (contracts.length === 0) {
    throw new Error('Custom options API returned no contracts')
  }

  return {
    symbol: asString(payload.symbol)?.toUpperCase() ?? symbol,
    spot,
    asOf: asString(payload.asOf) ?? now.toISOString(),
    source: 'custom',
    multiplier: asNumber(payload.multiplier) ?? 100,
    contracts,
  }
}
