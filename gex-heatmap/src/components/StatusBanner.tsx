import type { LoadResult } from '../types'

interface Props {
  result: LoadResult | null
  loading: boolean
}

export function StatusBanner({ result, loading }: Props) {
  if (loading && !result) {
    return (
      <div className="banner info" role="status">
        Loading options chain…
      </div>
    )
  }
  if (!result?.warning) return null
  const tone = result.fallback ? 'warn' : result.snapshot.source === 'demo' ? 'info' : 'info'
  return (
    <div className={`banner ${tone}`} role="status">
      {result.warning}
    </div>
  )
}
