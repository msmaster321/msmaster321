import type { HeatmapViewModel } from '../types'
import { formatPrice, formatUsdCompact, signedClass } from '../lib/format'

interface Props {
  view: HeatmapViewModel
}

export function SummaryCards({ view }: Props) {
  const unit = view.unit === 'pct' ? 'per 1% move' : 'per $1 move'
  const flipDelta =
    view.gammaFlip != null ? ((view.gammaFlip - view.spot) / view.spot) * 100 : null

  return (
    <section className="stats" aria-label="GEX summary">
      <article className="stat">
        <span className="stat-label">Total net GEX</span>
        <strong className={signedClass(view.totals.net)}>
          {formatUsdCompact(view.totals.net)}
        </strong>
        <span className="stat-sub">{unit}</span>
      </article>
      <article className="stat">
        <span className="stat-label">Call GEX</span>
        <strong className="pos">{formatUsdCompact(view.totals.call)}</strong>
        <span className="stat-sub">dealers long calls</span>
      </article>
      <article className="stat">
        <span className="stat-label">Put GEX</span>
        <strong className="neg">{formatUsdCompact(view.totals.put)}</strong>
        <span className="stat-sub">dealers short puts</span>
      </article>
      <article className="stat">
        <span className="stat-label">Gamma flip</span>
        <strong className="flip">
          {view.gammaFlip != null ? formatPrice(view.gammaFlip) : 'n/a'}
        </strong>
        <span className="stat-sub">
          {flipDelta == null
            ? 'no zero-gamma in window'
            : `${flipDelta >= 0 ? '+' : '−'}${Math.abs(flipDelta).toFixed(2)}% vs spot`}
        </span>
      </article>
      <article className="stat">
        <span className="stat-label">Spot</span>
        <strong className="spot">{formatPrice(view.spot)}</strong>
        <span className="stat-sub">{view.symbol}</span>
      </article>
    </section>
  )
}
