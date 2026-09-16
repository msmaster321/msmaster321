import type { DataSource, LoadResult } from '../types'

interface Props {
  result: LoadResult | null
  loading: boolean
  source: DataSource
  symbol: string
  onUseDemo: () => void
  onRetry: () => void
}

export function StatusBanner({
  result,
  loading,
  source,
  symbol,
  onUseDemo,
  onRetry,
}: Props) {
  if (loading && !result?.snapshot) {
    const live = source !== 'demo'
    return (
      <div className="banner info" role="status">
        {live
          ? `Fetching live ${source === 'custom' ? 'custom' : 'Yahoo'} options chain for ${symbol}…`
          : `Loading demo chain for ${symbol}…`}
      </div>
    )
  }

  if (result?.error) {
    return (
      <div className="banner warn" role="alert">
        <div>
          <strong>Live data failed.</strong> {result.error} This view is not a live chain.
        </div>
        <div className="banner-actions">
          <button type="button" className="btn" onClick={onRetry} disabled={loading}>
            Retry live
          </button>
          <button type="button" className="btn primary" onClick={onUseDemo}>
            Use demo data
          </button>
        </div>
      </div>
    )
  }

  if (result?.snapshot?.source === 'demo') {
    return (
      <div className="banner info" role="status">
        Synthetic demo chain — not live market data. Switch Data to Yahoo live for the real options chain.
      </div>
    )
  }

  return null
}
