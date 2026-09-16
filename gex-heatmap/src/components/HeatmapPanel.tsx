import { useMemo } from 'react'
import type { EChartsOption } from 'echarts'
import type { HeatmapViewModel } from '../types'
import { formatExpiryTick, formatExpiryLong } from '../lib/dates'
import {
  formatGamma,
  formatIv,
  formatOi,
  formatStrike,
  formatUsdCompact,
  formatUsdFull,
} from '../lib/format'
import { readClickPayload } from '../lib/chartClick'
import { categoryZoomAround } from '../lib/chartZoom'
import { heatmapDollarLabels } from '../lib/heatmapLabels'
import { cellDisplayValue, cellKey, nearestStrike } from '../lib/gex'
import { EChart } from './EChart'

const HEAT_COLORS = [
  '#7f1d1d',
  '#dc2626',
  '#fca5a5',
  '#1a2330',
  '#86efac',
  '#16a34a',
  '#14532d',
]

interface Props {
  view: HeatmapViewModel
  selectedStrike: number | null
  selectedExpiration: string | null
  onInspect: (strike: number, expiration?: string) => void
}

export function HeatmapPanel({
  view,
  selectedStrike,
  selectedExpiration,
  onInspect,
}: Props) {
  const option = useMemo(() => buildOption(view, selectedStrike, selectedExpiration), [
    view,
    selectedStrike,
    selectedExpiration,
  ])

  return (
    <section className="panel heatmap-panel">
      <header className="panel-head">
        <div>
          <h2>GEX heatmap</h2>
          <p>
            Strikes × expirations · {view.gexView === 'net' ? 'Net' : view.gexView === 'call' ? 'Call' : 'Put'}{' '}
            dealer GEX · {view.unit === 'pct' ? 'per 1% move' : 'per $1 move'} · $ on largest |GEX|
          </p>
        </div>
        <div className="legend-scale">
          <span className="neg">Short γ</span>
          <div className="scale-bar" />
          <span className="pos">Long γ</span>
        </div>
      </header>
      <div className="panel-body">
        {view.strikes.length === 0 || view.expirations.length === 0 ? (
          <div className="empty">No contracts in the current filter window.</div>
        ) : (
          <EChart
            option={option}
            onClick={(params) => {
              if (params.componentType !== 'series') return
              const payload = readClickPayload(params.data)
              if (payload) onInspect(payload.strike, payload.expiration)
            }}
          />
        )}
      </div>
    </section>
  )
}

function buildOption(
  view: HeatmapViewModel,
  selectedStrike: number | null,
  selectedExpiration: string | null,
): EChartsOption {
  const xLabels = view.expirations.map((exp) => {
    const sample = view.cells.find((c) => c.expiration === exp)
    return formatExpiryTick(exp, sample?.dte ?? 0)
  })
  const yLabels = view.strikes.map(formatStrike)
  const yZoom = categoryZoomAround(yLabels, view.strikes, view.spot, 28)
  const dollarLabels = heatmapDollarLabels(view.cells, view.gexView, view.colorMax)
  const data = []
  for (let yi = 0; yi < view.strikes.length; yi++) {
    const strike = view.strikes[yi]!
    for (let xi = 0; xi < view.expirations.length; xi++) {
      const expiration = view.expirations[xi]!
      const cell = view.cellMap.get(cellKey(strike, expiration))
      if (!cell) continue
      const value = cellDisplayValue(cell, view.gexView)
      const selected = selectedStrike === strike && selectedExpiration === expiration
      const usdLabel = dollarLabels.get(cellKey(strike, expiration)) ?? ''
      data.push({
        value: [xi, yi, value],
        strike,
        expiration,
        usdLabel,
        itemStyle: selected
          ? { borderColor: '#93c5fd', borderWidth: 1.5 }
          : { borderColor: '#07090c', borderWidth: 0.5 },
      })
    }
  }

  const spotStrike = nearestStrike(view.strikes, view.spot)
  const flipStrike =
    view.gammaFlip != null ? nearestStrike(view.strikes, view.gammaFlip) : null

  const markLineData: object[] = []
  if (spotStrike != null) {
    markLineData.push({
      yAxis: formatStrike(spotStrike),
      name: 'SPOT',
      label: {
        formatter: `SPOT ${formatStrike(view.spot)}`,
        color: '#67e8f9',
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: 11,
        position: 'insideStartTop',
      },
      lineStyle: { color: '#67e8f9', width: 1.7, type: 'solid' },
    })
  }
  if (flipStrike != null && view.gammaFlip != null) {
    markLineData.push({
      yAxis: formatStrike(flipStrike),
      name: 'FLIP',
      label: {
        formatter: `FLIP ${formatStrike(view.gammaFlip)}`,
        color: '#f5c14a',
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: 11,
        position: 'insideStartBottom',
      },
      lineStyle: { color: '#f5c14a', width: 1.4, type: 'dashed' },
    })
  }
  if (selectedStrike != null) {
    markLineData.push({
      yAxis: formatStrike(selectedStrike),
      name: 'K',
      label: {
        formatter: `K ${formatStrike(selectedStrike)}`,
        color: '#93c5fd',
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: 11,
        position: 'insideEndTop',
      },
      lineStyle: { color: '#60a5fa', width: 1, type: 'dotted' },
    })
  }

  return {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(10, 14, 20, 0.96)',
      borderColor: 'rgba(255,255,255,0.08)',
      padding: 12,
      textStyle: {
        color: '#e8eef6',
        fontFamily: 'IBM Plex Sans, sans-serif',
        fontSize: 12,
      },
      formatter: (raw) => {
        const params = raw as { data?: { strike?: number; expiration?: string } }
        const strike = params.data?.strike
        const expiration = params.data?.expiration
        if (strike == null || !expiration) return ''
        const cell = view.cellMap.get(cellKey(strike, expiration))
        if (!cell) return ''
        return [
          `<div class="tt">`,
          `<div class="tt-k">${view.symbol} ${formatStrike(cell.strike)}</div>`,
          `<div class="tt-exp">${formatExpiryLong(cell.expiration, cell.dte)}</div>`,
          tooltipGexRow('Net GEX', cell.netGex, cell.netGex >= 0 ? 'pos' : 'neg'),
          tooltipGexRow('Call GEX', cell.callGex, 'pos'),
          tooltipGexRow('Put GEX', cell.putGex, 'neg'),
          `<div class="tt-row"><span>Call OI</span><b>${formatOi(cell.callOi)}</b></div>`,
          `<div class="tt-row"><span>Put OI</span><b>${formatOi(cell.putOi)}</b></div>`,
          `<div class="tt-row"><span>Call γ / IV</span><b>${formatGamma(cell.callGamma)} · ${formatIv(cell.callIv)}</b></div>`,
          `<div class="tt-row"><span>Put γ / IV</span><b>${formatGamma(cell.putGamma)} · ${formatIv(cell.putIv)}</b></div>`,
          `</div>`,
        ].join('')
      },
    },
    grid: { left: 64, right: 36, top: 16, bottom: 88, containLabel: false },
    xAxis: {
      type: 'category',
      data: xLabels,
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.12)' } },
      axisTick: { show: false },
      axisLabel: {
        color: '#93a4bb',
        fontSize: 11,
        fontFamily: 'IBM Plex Sans, sans-serif',
        interval: 0,
        lineHeight: 16,
      },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'category',
      data: yLabels,
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.12)' } },
      axisTick: { show: false },
      axisLabel: {
        color: '#93a4bb',
        fontSize: 11,
        fontFamily: 'IBM Plex Mono, monospace',
      },
      splitLine: { show: false },
    },
    visualMap: {
      min: -view.colorMax,
      max: view.colorMax,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 10,
      itemWidth: 12,
      itemHeight: 140,
      text: ['+', '−'],
      textStyle: { color: '#8b9cb3', fontSize: 11 },
      inRange: { color: HEAT_COLORS },
      handleStyle: { borderColor: '#e8eef6' },
    },
    dataZoom: [
      {
        type: 'inside',
        yAxisIndex: 0,
        filterMode: 'none',
        zoomOnMouseWheel: true,
        ...yZoom,
      },
      { type: 'inside', xAxisIndex: 0, filterMode: 'none', zoomOnMouseWheel: false },
      {
        type: 'slider',
        yAxisIndex: 0,
        filterMode: 'none',
        width: 10,
        right: 8,
        top: 16,
        bottom: 88,
        ...yZoom,
        borderColor: 'transparent',
        backgroundColor: 'rgba(255,255,255,0.04)',
        fillerColor: 'rgba(74,163,255,0.18)',
        handleSize: 10,
        handleStyle: { color: '#4aa3ff' },
        dataBackground: { lineStyle: { color: 'transparent' }, areaStyle: { color: 'transparent' } },
        selectedDataBackground: { lineStyle: { color: 'transparent' }, areaStyle: { color: 'transparent' } },
        moveHandleSize: 0,
        textStyle: { color: 'transparent' },
        brushSelect: false,
      },
    ],
    series: [
      {
        type: 'heatmap',
        data,
        label: {
          show: true,
          fontSize: 9,
          fontWeight: 600,
          fontFamily: 'IBM Plex Mono, monospace',
          color: '#f8fafc',
          textBorderColor: 'rgba(7, 9, 12, 0.82)',
          textBorderWidth: 3,
          formatter: (params) => usdLabelFromParams(params),
        },
        emphasis: {
          itemStyle: { borderColor: '#e8eef6', borderWidth: 1, shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.4)' },
          label: {
            show: true,
            formatter: (params) => {
              const labeled = usdLabelFromParams(params)
              if (labeled) return labeled
              const triple = (params as { value?: unknown }).value
              const raw = Array.isArray(triple) ? Number(triple[2]) : Number.NaN
              return Number.isFinite(raw) && raw !== 0 ? formatUsdCompact(raw) : ''
            },
          },
        },
        itemStyle: { borderColor: '#07090c', borderWidth: 0.5 },
        markLine: {
          silent: true,
          symbol: 'none',
          animation: false,
          data: markLineData,
        },
      },
    ],
  }
}

function tooltipGexRow(label: string, value: number, cls: string): string {
  return `<div class="tt-row"><span>${label}</span><b class="${cls}">${formatUsdCompact(value)} <span class="tt-full">${formatUsdFull(value)}</span></b></div>`
}

function usdLabelFromParams(params: { data?: unknown }): string {
  if (params.data === null || typeof params.data !== 'object') return ''
  const label = (params.data as { usdLabel?: unknown }).usdLabel
  return typeof label === 'string' ? label : ''
}
