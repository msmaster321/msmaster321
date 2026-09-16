import { useCallback, useEffect, useMemo, useState } from 'react'
import { envCustomUrl, envDefaultSource, loadChain } from '../data/loadChain'
import { buildHeatmapView } from '../lib/gex'
import type {
  DataSource,
  ExpirationMode,
  GexUnit,
  GexView,
  LoadResult,
  StrikeWindow,
} from '../types'

const POPULAR = ['SPY', 'QQQ', 'IWM', 'SPX', 'AAPL', 'NVDA', 'TSLA', 'MSFT']

function uniqueExpirations(result: LoadResult | null): string[] {
  if (!result) return []
  return [...new Set(result.snapshot.contracts.map((c) => c.expiration))].sort()
}

function pickExpirations(
  all: string[],
  mode: ExpirationMode,
  custom: string[],
): string[] {
  if (all.length === 0) return []
  if (mode === 'all') return all
  if (mode === 'nearest4') return all.slice(0, 4)
  if (mode === 'nearest8') return all.slice(0, 8)
  const selected = all.filter((d) => custom.includes(d))
  return selected.length > 0 ? selected : all.slice(0, 4)
}

export function useGexSession() {
  const customUrl = envCustomUrl()
  const [symbolInput, setSymbolInput] = useState('SPY')
  const [symbol, setSymbol] = useState('SPY')
  const [source, setSource] = useState<DataSource>(envDefaultSource())
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<LoadResult | null>(null)
  const [expirationMode, setExpirationMode] = useState<ExpirationMode>('nearest8')
  const [customExpirations, setCustomExpirations] = useState<string[]>([])
  const [gexView, setGexView] = useState<GexView>('net')
  const [unit, setUnit] = useState<GexUnit>('pct')
  const [strikeWindow, setStrikeWindow] = useState<StrikeWindow>(0.1)
  const [selectedStrike, setSelectedStrike] = useState<number | null>(null)
  const [selectedExpiration, setSelectedExpiration] = useState<string | null>(null)
  const [reloadNonce, setReloadNonce] = useState(0)

  const reload = useCallback(() => {
    setReloadNonce((n) => n + 1)
  }, [])

  const submitSymbol = useCallback((next?: string) => {
    const trimmed = (next ?? symbolInput).trim().toUpperCase()
    if (!trimmed) return
    setSymbolInput(trimmed)
    setSymbol(trimmed)
    setSelectedStrike(null)
    setSelectedExpiration(null)
  }, [symbolInput])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    void loadChain(symbol, source, customUrl, controller.signal)
      .then((next) => {
        if (controller.signal.aborted) return
        setResult(next)
        const dates = uniqueExpirations(next)
        setCustomExpirations((prev) => prev.filter((d) => dates.includes(d)))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [symbol, source, customUrl, reloadNonce])

  const allExpirations = useMemo(() => uniqueExpirations(result), [result])
  const activeExpirations = useMemo(
    () => pickExpirations(allExpirations, expirationMode, customExpirations),
    [allExpirations, expirationMode, customExpirations],
  )

  const view = useMemo(() => {
    if (!result) return null
    return buildHeatmapView(result.snapshot, {
      expirations: activeExpirations,
      gexView,
      unit,
      strikeWindow,
    })
  }, [result, activeExpirations, gexView, unit, strikeWindow])

  const inspect = useCallback((strike: number, expiration?: string) => {
    setSelectedStrike(strike)
    if (expiration) setSelectedExpiration(expiration)
  }, [])

  return {
    popular: POPULAR,
    symbolInput,
    setSymbolInput,
    submitSymbol,
    symbol,
    source,
    setSource,
    customUrl,
    loading,
    result,
    view,
    allExpirations,
    activeExpirations,
    expirationMode,
    setExpirationMode,
    customExpirations,
    setCustomExpirations,
    gexView,
    setGexView,
    unit,
    setUnit,
    strikeWindow,
    setStrikeWindow,
    selectedStrike,
    selectedExpiration,
    inspect,
    clearInspect: () => {
      setSelectedStrike(null)
      setSelectedExpiration(null)
    },
    reload,
  }
}

export type GexSession = ReturnType<typeof useGexSession>
