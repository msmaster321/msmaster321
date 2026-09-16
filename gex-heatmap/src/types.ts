export type OptionRight = 'call' | 'put'
export type GexView = 'net' | 'call' | 'put'
export type GexUnit = 'pct' | 'dollar'
export type DataSource = 'demo' | 'yahoo' | 'custom'
export type ExpirationMode = 'all' | 'nearest4' | 'nearest8' | 'custom'
export type StrikeWindow = 0.05 | 0.1 | 0.15 | 'all'

export interface OptionContract {
  expiration: string
  strike: number
  right: OptionRight
  openInterest: number
  impliedVolatility: number
  gamma: number
}

export interface ChainSnapshot {
  symbol: string
  spot: number
  asOf: string
  source: DataSource
  multiplier: number
  contracts: OptionContract[]
}

export interface GexCell {
  strike: number
  expiration: string
  dte: number
  callOi: number
  putOi: number
  callGex: number
  putGex: number
  netGex: number
  callGamma: number
  putGamma: number
  callIv: number
  putIv: number
}

export interface StrikeProfileRow {
  strike: number
  callOi: number
  putOi: number
  callGex: number
  putGex: number
  netGex: number
}

export interface HeatmapViewModel {
  symbol: string
  spot: number
  asOf: string
  source: DataSource
  unit: GexUnit
  gexView: GexView
  expirations: string[]
  strikes: number[]
  cells: GexCell[]
  cellMap: Map<string, GexCell>
  profile: StrikeProfileRow[]
  totals: { net: number; call: number; put: number }
  gammaFlip: number | null
  colorMax: number
}

export interface LoadResult {
  snapshot: ChainSnapshot | null
  error: string | null
  requestedSource: DataSource
}
