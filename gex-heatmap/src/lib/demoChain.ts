import type { ChainSnapshot, OptionContract } from '../types'
import { bsGamma } from './blackScholes'
import { buildDemoExpirations, dte, timeToExpiryYears } from './dates'
import { hashString, mulberry32 } from './rng'

interface UnderlyingSpec {
  spot: number
  iv: number
  hasZeroDte: boolean
  strikeStep: number
  multiplier: number
  putHeavy: number
}

const SPECS: Record<string, UnderlyingSpec> = {
  SPY: { spot: 642.35, iv: 0.132, hasZeroDte: true, strikeStep: 1, multiplier: 100, putHeavy: 1.18 },
  QQQ: { spot: 548.2, iv: 0.168, hasZeroDte: true, strikeStep: 1, multiplier: 100, putHeavy: 1.12 },
  IWM: { spot: 226.4, iv: 0.21, hasZeroDte: true, strikeStep: 1, multiplier: 100, putHeavy: 1.22 },
  SPX: { spot: 6448.5, iv: 0.128, hasZeroDte: true, strikeStep: 5, multiplier: 100, putHeavy: 1.2 },
  NDX: { spot: 22840, iv: 0.162, hasZeroDte: true, strikeStep: 25, multiplier: 100, putHeavy: 1.1 },
  AAPL: { spot: 228.6, iv: 0.24, hasZeroDte: false, strikeStep: 2.5, multiplier: 100, putHeavy: 1.08 },
  NVDA: { spot: 176.4, iv: 0.42, hasZeroDte: false, strikeStep: 2.5, multiplier: 100, putHeavy: 1.05 },
  TSLA: { spot: 248.9, iv: 0.52, hasZeroDte: false, strikeStep: 2.5, multiplier: 100, putHeavy: 1.15 },
  MSFT: { spot: 428.15, iv: 0.22, hasZeroDte: false, strikeStep: 2.5, multiplier: 100, putHeavy: 1.06 },
  AMZN: { spot: 198.4, iv: 0.28, hasZeroDte: false, strikeStep: 1, multiplier: 100, putHeavy: 1.07 },
  META: { spot: 562.8, iv: 0.3, hasZeroDte: false, strikeStep: 5, multiplier: 100, putHeavy: 1.08 },
  GOOG: { spot: 175.2, iv: 0.26, hasZeroDte: false, strikeStep: 2.5, multiplier: 100, putHeavy: 1.06 },
  AMD: { spot: 162.75, iv: 0.44, hasZeroDte: false, strikeStep: 2.5, multiplier: 100, putHeavy: 1.1 },
  COIN: { spot: 248.3, iv: 0.62, hasZeroDte: false, strikeStep: 5, multiplier: 100, putHeavy: 1.16 },
}

function specFor(symbol: string): UnderlyingSpec {
  const known = SPECS[symbol]
  if (known) return { ...known }
  const rng = mulberry32(hashString(symbol))
  const spot = Math.round((35 + rng() * 420) * 100) / 100
  const step = spot > 400 ? 5 : spot > 180 ? 2.5 : spot > 40 ? 1 : 0.5
  return {
    spot,
    iv: 0.22 + rng() * 0.38,
    hasZeroDte: false,
    strikeStep: step,
    multiplier: 100,
    putHeavy: 1.05 + rng() * 0.2,
  }
}

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step
}

function impliedVol(
  strike: number,
  spot: number,
  tYears: number,
  baseIv: number,
  right: 'call' | 'put',
): number {
  const m = Math.log(Math.max(strike, 1e-6) / spot)
  const skew = right === 'put' ? -1.15 * Math.min(m, 0) : 0.35 * Math.max(m, 0)
  const smile = 0.55 * m * m
  const term = 1 + 0.28 * Math.exp(-Math.max(tYears, 0.002) * 55)
  return Math.max(0.07, (baseIv + skew + smile) * term)
}

function openInterest(params: {
  strike: number
  spot: number
  dteDays: number
  right: 'call' | 'put'
  putHeavy: number
  rng: () => number
}): number {
  const { strike, spot, dteDays, right, putHeavy, rng } = params
  const moneyness = (strike - spot) / spot
  const center = right === 'call' ? 0.012 : -0.018
  const width = 0.032 + Math.min(Math.max(dteDays, 0), 90) / 1400
  const gauss = Math.exp(-0.5 * ((moneyness - center) / width) ** 2)
  const roundBoost =
    (Math.abs(strike % 5) < 1e-6 ? 1.55 : 1) *
    (Math.abs(strike % 10) < 1e-6 ? 1.35 : 1) *
    (Math.abs(strike % 25) < 1e-6 && spot > 200 ? 1.25 : 1)
  const term =
    dteDays <= 0 ? 0.42 : dteDays <= 4 ? 0.78 : dteDays <= 11 ? 1.05 : dteDays <= 45 ? 1.38 : 0.72
  const side = right === 'put' ? putHeavy : 1
  const base = 14_000 * (spot > 1000 ? 0.55 : 1)
  const noise = 0.62 + rng() * 0.7
  return Math.max(0, Math.round(base * gauss * roundBoost * term * side * noise))
}

export function buildDemoChain(symbolRaw: string, now = new Date()): ChainSnapshot {
  const symbol = symbolRaw.trim().toUpperCase() || 'SPY'
  const spec = specFor(symbol)
  const rng = mulberry32(hashString(`${symbol}|${now.toISOString().slice(0, 10)}`))
  const expirations = buildDemoExpirations(now, spec.hasZeroDte)
  const lo = roundToStep(spec.spot * 0.86, spec.strikeStep)
  const hi = roundToStep(spec.spot * 1.14, spec.strikeStep)
  const contracts: OptionContract[] = []

  for (const expiration of expirations) {
    const days = dte(expiration, now)
    const t = timeToExpiryYears(expiration, now)
    for (let strike = lo; strike <= hi + spec.strikeStep / 2; strike += spec.strikeStep) {
      const k = Number(strike.toFixed(4))
      for (const right of ['call', 'put'] as const) {
        const iv = impliedVol(k, spec.spot, t, spec.iv, right)
        const oi = openInterest({
          strike: k,
          spot: spec.spot,
          dteDays: days,
          right,
          putHeavy: spec.putHeavy,
          rng,
        })
        contracts.push({
          expiration,
          strike: k,
          right,
          openInterest: oi,
          impliedVolatility: iv,
          gamma: bsGamma(spec.spot, k, t, iv),
        })
      }
    }
  }

  return {
    symbol,
    spot: spec.spot,
    asOf: now.toISOString(),
    source: 'demo',
    multiplier: spec.multiplier,
    contracts,
  }
}
