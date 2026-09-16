import type { GexCell, GexView } from '../types'
import { formatUsdCompact } from './format'
import { cellDisplayValue, cellKey } from './gex'

/**
 * Pick a sparse set of heatmap cells to stamp with compact $ GEX so the
 * grid stays readable. Labels the top-|GEX| cells, each expiry's peak if
 * it is meaningful, and anything at least ~40% of the color scale max.
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
  const topN = Math.min(28, Math.max(14, Math.ceil(ranked.length * 0.07)))
  const magnitudeFloor = Math.max(colorMax * 0.42, 1)

  for (const [index, row] of ranked.entries()) {
    if (index < topN || row.abs >= magnitudeFloor) labeled.add(row.key)
  }

  const peakByExpiry = new Map<string, (typeof ranked)[number]>()
  for (const row of ranked) {
    const prev = peakByExpiry.get(row.expiration)
    if (!prev || row.abs > prev.abs) peakByExpiry.set(row.expiration, row)
  }
  for (const row of peakByExpiry.values()) {
    if (row.abs >= Math.max(colorMax * 0.18, 1)) labeled.add(row.key)
  }

  const labels = new Map<string, string>()
  for (const row of ranked) {
    if (!labeled.has(row.key)) continue
    labels.set(row.key, formatUsdCompact(row.value))
  }
  return labels
}
