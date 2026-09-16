import { buildDemoChain } from '../lib/demoChain'
import type { DataSource, LoadResult } from '../types'
import { fetchCustomChain } from './custom'
import { fetchYahooChain } from './yahoo'

const LIVE_TIMEOUT_MS = 20_000

function timeoutSignal(parent?: AbortSignal): AbortSignal {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), LIVE_TIMEOUT_MS)
  const onAbort = () => controller.abort()
  parent?.addEventListener('abort', onAbort)
  controller.signal.addEventListener('abort', () => {
    window.clearTimeout(timer)
    parent?.removeEventListener('abort', onAbort)
  })
  return controller.signal
}

function fail(requestedSource: DataSource, error: unknown): LoadResult {
  const message =
    error instanceof Error
      ? error.name === 'AbortError'
        ? 'Live request timed out'
        : error.message
      : 'Unknown live-data error'
  return {
    snapshot: null,
    error: message,
    requestedSource,
  }
}

export async function loadChain(
  symbol: string,
  source: DataSource,
  customUrl: string | undefined,
  signal?: AbortSignal,
): Promise<LoadResult> {
  const now = new Date()

  if (source === 'demo') {
    return {
      snapshot: buildDemoChain(symbol, now),
      error: null,
      requestedSource: 'demo',
    }
  }

  try {
    const liveSignal = timeoutSignal(signal)
    if (source === 'custom') {
      if (!customUrl) throw new Error('VITE_OPTIONS_API_URL is not configured')
      const snapshot = await fetchCustomChain(customUrl, symbol, liveSignal, now)
      return { snapshot, error: null, requestedSource: 'custom' }
    }
    const snapshot = await fetchYahooChain(symbol, liveSignal, now)
    return { snapshot, error: null, requestedSource: 'yahoo' }
  } catch (error) {
    if (signal?.aborted) {
      return { snapshot: null, error: null, requestedSource: source }
    }
    return fail(source, error)
  }
}

export function envDefaultSource(): DataSource {
  const value = import.meta.env.VITE_DATA_SOURCE?.toLowerCase()
  if (value === 'yahoo' || value === 'custom' || value === 'demo') return value
  if (import.meta.env.VITE_OPTIONS_API_URL) return 'custom'
  return 'yahoo'
}

export function envCustomUrl(): string | undefined {
  const value = import.meta.env.VITE_OPTIONS_API_URL
  return value && value.trim() !== '' ? value : undefined
}
