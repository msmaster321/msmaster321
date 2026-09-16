import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'

interface ChartClickParams {
  componentType?: string
  seriesType?: string
  data?: unknown
}

interface Props {
  option: EChartsOption
  onClick?: (params: ChartClickParams) => void
}

export function EChart({ option, onClick }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)
  const clickRef = useRef(onClick)

  useEffect(() => {
    clickRef.current = onClick
  }, [onClick])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const chart = echarts.init(host, undefined, { renderer: 'canvas' })
    chartRef.current = chart
    const onChartClick = (params: ChartClickParams) => {
      clickRef.current?.(params)
    }
    chart.on('click', onChartClick)
    const observer = new ResizeObserver(() => {
      chart.resize()
    })
    observer.observe(host)
    return () => {
      observer.disconnect()
      chart.off('click', onChartClick)
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true, lazyUpdate: true })
  }, [option])

  return <div ref={hostRef} className="chart-root" role="img" />
}
