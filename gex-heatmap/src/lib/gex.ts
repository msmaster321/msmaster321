import type {
  ChainSnapshot,
  GexCell,
  GexUnit,
  GexView,
  HeatmapViewModel,
  OptionContract,
  StrikeProfileRow,
  StrikeWindow,
} from '../types'
import { bsGamma } from './blackScholes'
import { dte, timeToExpiryYears } from './dates'

const RISK_FREE = 0.045

/** Dollar GEX for a 1% move: Γ × OI × multiplier × S² × 0.01 */
export function gexForOnePercent(
  gamma: number,
  openInterest: number,
  spot: number,
  multiplier: number,
): number {
  return gamma * openInterest * multiplier * spot * spot * 0.01
}

/** Dollar GEX for a $1 move: Γ × OI × multiplier × S */
export function gexForOneDollar(
  gamma: number,
  openInterest: number,
  spot: number,
  multiplier: number,
): number {
  return gamma * openInterest * multiplier * spot
}

export function gexNotional(
  gamma: number,
  openInterest: number,
  spot: number,
  multiplier: number,
  unit: GexUnit,
): number {
  return unit === 'pct'
    ? gexForOnePercent(gamma, openInterest, spot, multiplier)
    : gexForOneDollar(gamma, openInterest, spot, multiplier)
}

/**
 * Dealer sign convention (SqueezeMetrics / SpotGamma-style):
 * dealers are treated as long calls and short puts, so call GEX is
 * positive and put GEX is negative.
 */
export function signedDealerGex(
  right: 'call' | 'put',
  gamma: number,
  openInterest: number,
  spot: number,
  multiplier: number,
  unit: GexUnit,
): number {
  const raw = gexNotional(gamma, openInterest, spot, multiplier, unit)
  return right === 'call' ? raw : -raw
}

export function cellKey(strike: number, expiration: string): string {
  return `${expiration}|${strike}`
}

function displayValue(cell: GexCell, view: GexView): number {
  if (view === 'call') return cell.callGex
  if (view === 'put') return cell.putGex
  return cell.netGex
}

function percentileAbs(values: number[], p: number): number {
  if (values.length === 0) return 1
  const sorted = [...values].sort((a, b) => a - b)
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  const value =
    lo === hi ? sorted[lo]! : sorted[lo]! * (hi - idx) + sorted[hi]! * (idx - lo)
  return Math.max(value, 1)
}

function aggregateCells(
  snapshot: ChainSnapshot,
  contracts: OptionContract[],
  unit: GexUnit,
  now: Date,
): GexCell[] {
  const groups = new Map<string, GexCell>()

  for (const contract of contracts) {
    const t = timeToExpiryYears(contract.expiration, now)
    const gamma = bsGamma(
      snapshot.spot,
      contract.strike,
      t,
      contract.impliedVolatility,
      RISK_FREE,
    )
    const gex = signedDealerGex(
      contract.right,
      gamma,
      contract.openInterest,
      snapshot.spot,
      snapshot.multiplier,
      unit,
    )
    const key = cellKey(contract.strike, contract.expiration)
    let cell = groups.get(key)
    if (!cell) {
      cell = {
        strike: contract.strike,
        expiration: contract.expiration,
        dte: dte(contract.expiration, now),
        callOi: 0,
        putOi: 0,
        callGex: 0,
        putGex: 0,
        netGex: 0,
        callGamma: 0,
        putGamma: 0,
        callIv: 0,
        putIv: 0,
      }
      groups.set(key, cell)
    }
    if (contract.right === 'call') {
      cell.callOi += contract.openInterest
      cell.callGex += gex
      cell.callGamma = gamma
      cell.callIv = contract.impliedVolatility
    } else {
      cell.putOi += contract.openInterest
      cell.putGex += gex
      cell.putGamma = gamma
      cell.putIv = contract.impliedVolatility
    }
    cell.netGex = cell.callGex + cell.putGex
  }

  return [...groups.values()]
}

function netGexAtSpot(
  contracts: OptionContract[],
  spot: number,
  multiplier: number,
  unit: GexUnit,
  now: Date,
): number {
  let total = 0
  for (const contract of contracts) {
    const gamma = bsGamma(
      spot,
      contract.strike,
      timeToExpiryYears(contract.expiration, now),
      contract.impliedVolatility,
      RISK_FREE,
    )
    total += signedDealerGex(
      contract.right,
      gamma,
      contract.openInterest,
      spot,
      multiplier,
      unit,
    )
  }
  return total
}

/**
 * Zero-gamma / flip level: hypothetical spot where total net dealer GEX
 * changes sign, holding IV sticky-strike and OI fixed.
 */
export function estimateGammaFlip(
  contracts: OptionContract[],
  spot: number,
  multiplier: number,
  unit: GexUnit,
  now = new Date(),
): number | null {
  if (contracts.length === 0 || !(spot > 0)) return null

  const lo = spot * 0.82
  const hi = spot * 1.18
  const steps = 96
  const xs: number[] = []
  const ys: number[] = []
  for (let i = 0; i <= steps; i++) {
    const s = lo + ((hi - lo) * i) / steps
    xs.push(s)
    ys.push(netGexAtSpot(contracts, s, multiplier, unit, now))
  }

  const crossings: number[] = []
  for (let i = 1; i < ys.length; i++) {
    const y0 = ys[i - 1]!
    const y1 = ys[i]!
    const x0 = xs[i - 1]!
    const x1 = xs[i]!
    if (y0 === 0) crossings.push(x0)
    else if (y0 * y1 < 0) {
      const t = y0 / (y0 - y1)
      crossings.push(x0 + t * (x1 - x0))
    }
  }

  if (crossings.length === 0) return null
  crossings.sort((a, b) => Math.abs(a - spot) - Math.abs(b - spot))
  return crossings[0] ?? null
}

export function buildHeatmapView(
  snapshot: ChainSnapshot,
  opts: {
    expirations: string[]
    gexView: GexView
    unit: GexUnit
    strikeWindow: StrikeWindow
    now?: Date
  },
): HeatmapViewModel {
  const now = opts.now ?? new Date()
  const wanted = new Set(opts.expirations)
  const contracts = snapshot.contracts.filter((c) => wanted.has(c.expiration))
  const cells = aggregateCells(snapshot, contracts, opts.unit, now)

  const allStrikes = [...new Set(cells.map((c) => c.strike))].sort((a, b) => a - b)
  const lo =
    opts.strikeWindow === 'all' ? -Infinity : snapshot.spot * (1 - opts.strikeWindow)
  const hi =
    opts.strikeWindow === 'all' ? Infinity : snapshot.spot * (1 + opts.strikeWindow)
  const strikes = allStrikes.filter((k) => k >= lo && k <= hi)

  const strikeSet = new Set(strikes)
  const visibleCells = cells.filter((c) => strikeSet.has(c.strike))
  const cellMap = new Map(visibleCells.map((c) => [cellKey(c.strike, c.expiration), c]))

  const profileMap = new Map<number, StrikeProfileRow>()
  for (const strike of strikes) {
    profileMap.set(strike, {
      strike,
      callOi: 0,
      putOi: 0,
      callGex: 0,
      putGex: 0,
      netGex: 0,
    })
  }
  for (const cell of visibleCells) {
    const row = profileMap.get(cell.strike)
    if (!row) continue
    row.callOi += cell.callOi
    row.putOi += cell.putOi
    row.callGex += cell.callGex
    row.putGex += cell.putGex
    row.netGex += cell.netGex
  }
  const profile = [...profileMap.values()]

  const totals = visibleCells.reduce(
    (acc, cell) => {
      acc.call += cell.callGex
      acc.put += cell.putGex
      acc.net += cell.netGex
      return acc
    },
    { net: 0, call: 0, put: 0 },
  )

  const absValues = visibleCells.map((c) => Math.abs(displayValue(c, opts.gexView)))
  const colorMax = percentileAbs(absValues, 0.93)

  return {
    symbol: snapshot.symbol,
    spot: snapshot.spot,
    asOf: snapshot.asOf,
    source: snapshot.source,
    unit: opts.unit,
    gexView: opts.gexView,
    expirations: [...opts.expirations].sort(),
    strikes,
    cells: visibleCells,
    cellMap,
    profile,
    totals,
    gammaFlip: estimateGammaFlip(
      contracts,
      snapshot.spot,
      snapshot.multiplier,
      opts.unit,
      now,
    ),
    colorMax,
  }
}

export function cellDisplayValue(cell: GexCell, view: GexView): number {
  return displayValue(cell, view)
}

export function nearestStrike(strikes: number[], price: number): number | null {
  if (strikes.length === 0) return null
  let best = strikes[0]!
  let bestDist = Math.abs(best - price)
  for (const strike of strikes) {
    const dist = Math.abs(strike - price)
    if (dist < bestDist) {
      best = strike
      bestDist = dist
    }
  }
  return best
}
