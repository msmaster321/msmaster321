import { useMemo } from 'react'
import type { EChartsOption } from 'echarts'
import type { HeatmapViewModel } from '../types'
import { formatStrike, formatUsdCompact } from '../lib/format'
import { readClickPayload } from '../lib/chartClick'
import { nearestStrike } from '../lib/gex'
import { EChart } from './EChart'

interface Props {
  view: HeatmapViewModel
  selectedStrike: number | null
  onInspect: (strike: number) => void
}

export function ProfilePanel({ view, selectedStrike, onInspect }: Props) {
  const option = useMemo(() => buildOption(view, selectedStrike), [view, selectedStrike])

  return (
    <section className="panel profile-panel">
      <header className="panel-head">
        <div>
          <h2>Net GEX by strike</h2>
          <p>Summed across selected expirations</p>
        </div>
      </header>
      <div className="panel-body">
        {view.profile.length === 0 ? (
          <div className="empty">No strike profile to display.</div>
        ) : (
          <EChart
            option={option}
            onClick={(params) => {
              if (params.componentType !== 'series') return
              const payload = readClickPayload(params.data)
              if (payload) onInspect(payload.strike)
            }}
          />
        )}
      </div>
    </section>
  )
}

function buildOption(view: HeatmapViewModel, selectedStrike: number | null): EChartsOption {
  const labels = view.profile.map((row) => formatStrike(row.strike))
  const values = view.profile.map((row) => {
    const value =
      view.gexView === 'call' ? row.callGex : view.gexView === 'put' ? row.putGex : row.netGex
    return {
      value,
      strike: row.strike,
      itemStyle: {
        color:
          selectedStrike === row.strike
            ? value >= 0
              ? '#6ee7b7'
              : '#fda4af'
            : value >= 0
              ? '#16a34a'
              : '#dc2626',
        opacity: selectedStrike == null || selectedStrike === row.strike ? 1 : 0.38,
      },
    }
  })

  const spotStrike = nearestStrike(view.strikes, view.spot)
  const flipStrike =
    view.gammaFlip != null ? nearestStrike(view.strikes, view.gammaFlip) : null
  const markLineData: object[] = [{ xAxis: 0, lineStyle: { color: 'rgba(255,255,255,0.2)', type: 'solid', width: 1 }, label: { show: false } }]
  if (spotStrike != null) {
    markLineData.push({
      yAxis: formatStrike(spotStrike),
      label: { formatter: 'SPOT', color: '#67e8f9', fontSize: 10 },
      lineStyle: { color: '#67e8f9', type: 'solid', width: 1.4 },
    })
  }
  if (flipStrike != null) {
    markLineData.push({
      yAxis: formatStrike(flipStrike),
      label: { formatter: 'FLIP', color: '#f5c14a', fontSize: 10 },
      lineStyle: { color: '#f5c14a', type: 'dashed', width: 1.2 },
    })
  }

  return {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line' },
      backgroundColor: 'rgba(10, 14, 20, 0.96)',
      borderColor: 'rgba(255,255,255,0.08)',
      textStyle: { color: '#e8eef6', fontSize: 12 },
      formatter: (raw) => {
        const list = Array.isArray(raw) ? raw : [raw]
        const first = list[0] as { data?: { strike?: number; value?: number } }
        const strike = first.data?.strike
        if (strike == null) return ''
        const row = view.profile.find((r) => r.strike === strike)
        if (!row) return ''
        return [
          `<div class="tt">`,
          `<div class="tt-k">Strike ${formatStrike(row.strike)}</div>`,
          `<div class="tt-row"><span>Net</span><b class="${row.netGex >= 0 ? 'pos' : 'neg'}">${formatUsdCompact(row.netGex)}</b></div>`,
          `<div class="tt-row"><span>Calls</span><b class="pos">${formatUsdCompact(row.callGex)}</b></div>`,
          `<div class="tt-row"><span>Puts</span><b class="neg">${formatUsdCompact(row.putGex)}</b></div>`,
          `</div>`,
        ].join('')
      },
    },
    grid: { left: 56, right: 16, top: 12, bottom: 36, containLabel: false },
    xAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      axisLabel: {
        color: '#8b9cb3',
        fontSize: 10,
        fontFamily: 'IBM Plex Mono, monospace',
        formatter: (v: number) => formatUsdCompact(v, false),
      },
    },
    yAxis: {
      type: 'category',
      data: labels,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.12)' } },
      axisLabel: {
        color: '#93a4bb',
        fontSize: 11,
        fontFamily: 'IBM Plex Mono, monospace',
      },
    },
    dataZoom: [
      { type: 'inside', yAxisIndex: 0, filterMode: 'none' },
      {
        type: 'slider',
        yAxisIndex: 0,
        filterMode: 'none',
        width: 8,
        right: 2,
        top: 12,
        bottom: 36,
        borderColor: 'transparent',
        backgroundColor: 'rgba(255,255,255,0.04)',
        fillerColor: 'rgba(74,163,255,0.18)',
        handleSize: 8,
        handleStyle: { color: '#4aa3ff' },
        moveHandleSize: 0,
        textStyle: { color: 'transparent' },
        brushSelect: false,
      },
    ],
    series: [
      {
        type: 'bar',
        data: values,
        barWidth: '68%',
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
