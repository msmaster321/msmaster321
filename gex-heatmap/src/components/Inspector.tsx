import type { HeatmapViewModel } from '../types'
import { formatExpiryLong } from '../lib/dates'
import {
  formatGamma,
  formatIv,
  formatOi,
  formatStrike,
  formatUsdCompact,
  signedClass,
} from '../lib/format'

interface Props {
  view: HeatmapViewModel
  strike: number
  expiration: string | null
  onClose: () => void
}

export function Inspector({ view, strike, expiration, onClose }: Props) {
  const rows = view.expirations
    .map((exp) => view.cellMap.get(`${exp}|${strike}`))
    .filter((cell): cell is NonNullable<typeof cell> => cell != null)

  const totals = rows.reduce(
    (acc, row) => {
      acc.net += row.netGex
      acc.call += row.callGex
      acc.put += row.putGex
      acc.callOi += row.callOi
      acc.putOi += row.putOi
      return acc
    },
    { net: 0, call: 0, put: 0, callOi: 0, putOi: 0 },
  )

  return (
    <section className="inspector" aria-label="Strike inspector">
      <header>
        <div>
          <h2>
            Strike {formatStrike(strike)}
            <span>
              {view.symbol} · {((strike - view.spot) / view.spot) * 100 >= 0 ? '+' : '−'}
              {Math.abs(((strike - view.spot) / view.spot) * 100).toFixed(2)}% vs spot
            </span>
          </h2>
          <p>
            Net {formatUsdCompact(totals.net)} · Call OI {formatOi(totals.callOi)} · Put OI{' '}
            {formatOi(totals.putOi)}
          </p>
        </div>
        <button type="button" className="btn" onClick={onClose}>
          Close
        </button>
      </header>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Expiration</th>
              <th>Net GEX</th>
              <th>Call GEX</th>
              <th>Put GEX</th>
              <th>Call OI</th>
              <th>Put OI</th>
              <th>Call γ / IV</th>
              <th>Put γ / IV</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.expiration}
                className={row.expiration === expiration ? 'is-active' : undefined}
              >
                <td>{formatExpiryLong(row.expiration, row.dte)}</td>
                <td className={signedClass(row.netGex)}>{formatUsdCompact(row.netGex)}</td>
                <td className="pos">{formatUsdCompact(row.callGex)}</td>
                <td className="neg">{formatUsdCompact(row.putGex)}</td>
                <td>{formatOi(row.callOi)}</td>
                <td>{formatOi(row.putOi)}</td>
                <td>
                  {formatGamma(row.callGamma)} · {formatIv(row.callIv)}
                </td>
                <td>
                  {formatGamma(row.putGamma)} · {formatIv(row.putIv)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
