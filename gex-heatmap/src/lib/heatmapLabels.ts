import type { GexCell, GexView } from '../types'
import { formatUsdCompact } from './format'
import { cellDisplayValue, cellKey } from './gex'

const TOP_N = 16
const MAX_PER_EXPIRY = 3
const MAGNITUDE_RATIO = 0.62
const PEAK_RATIO = 0.22

/**
 * Pick a sparse set of heatmap cells to stamp with compact $ GEX so the
 * grid stays readable. Labels the top-|GEX| cells, each expiry's peak if
 * meaningful, then caps labels per expiration column.
 */
export function heatmapDollarLabels(
  cells: GexCell[],
  gexView: GexView,
  colorMax: number,
): Map<string, string> {
  const ranked = cells
    .map((cell) => {
      const value = cellDisplayValue(cell, gexView)
      return {
        key: cellKey(cell.strike, cell.expiration),
        expiration: cell.expiration,
        value,
        abs: Math.abs(value),
      }
    })
    .filter((row) => Number.isFinite(row.abs) && row.abs > 0)
    .sort((a, b) => b.abs - a.abs)

  const labeled = new Set<string>()
  const magnitudeFloor = Math.max(colorMax * MAGNITUDE_RATIO, 1)

  for (const [index, row] of ranked.entries()) {
    if (index < TOP_N || row.abs >= magnitudeFloor) labeled.add(row.key)
  }

  const peakByExpiry = new Map<string, (typeof ranked)[number]>()
  for (const row of ranked) {
    const prev = peakByExpiry.get(row.expiration)
    if (!prev || row.abs > prev.abs) peakByExpiry.set(row.expiration, row)
  }
  for (const row of peakByExpiry.values()) {
    if (row.abs >= Math.max(colorMax * PEAK_RATIO, 1)) labeled.add(row.key)
  }

  const perExpiry: Record<string, typeof ranked> = {}
  for (const row of ranked) {
    if (!labeled.has(row.key)) continue
    const list = perExpiry[row.expiration] ?? (perExpiry[row.expiration] = [])
    list.push(row)
  }
  labeled.clear()
  for (const list of Object.values(perExpiry)) {
    for (const row of list.slice(0, MAX_PER_EXPIRY)) labeled.add(row.key)
  }

  const labels = new Map<string, string>()
  for (const row of ranked) {
    if (!labeled.has(row.key)) continue
    labels.set(row.key, formatUsdCompact(row.value))
  }
  return labels
}
