import type { GexSession } from '../hooks/useGexSession'
import { formatExpiryLong } from '../lib/dates'
import { dte } from '../lib/dates'
import type { DataSource, ExpirationMode, GexUnit, GexView, StrikeWindow } from '../types'

interface Props {
  session: GexSession
}

const EXP_MODES: { id: ExpirationMode; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'nearest4', label: 'Nearest 4' },
  { id: 'nearest8', label: 'Nearest 8' },
  { id: 'custom', label: 'Custom' },
]

const VIEWS: { id: GexView; label: string }[] = [
  { id: 'net', label: 'Net GEX' },
  { id: 'call', label: 'Call GEX' },
  { id: 'put', label: 'Put GEX' },
]

const UNITS: { id: GexUnit; label: string }[] = [
  { id: 'pct', label: '1% move' },
  { id: 'dollar', label: '$1 move' },
]

const WINDOWS: { id: StrikeWindow; label: string }[] = [
  { id: 0.05, label: '±5%' },
  { id: 0.1, label: '±10%' },
  { id: 0.15, label: '±15%' },
  { id: 'all', label: 'All K' },
]

export function Toolbar({ session }: Props) {
  const sources: { id: DataSource; label: string }[] = [
    { id: 'demo', label: 'Demo' },
    { id: 'yahoo', label: 'Yahoo live' },
  ]
  if (session.customUrl) sources.push({ id: 'custom', label: 'Custom API' })

  return (
    <form
      className="toolbar"
      onSubmit={(event) => {
        event.preventDefault()
        session.submitSymbol()
      }}
    >
      <div className="toolbar-row">
        <label className="symbol-field">
          <span>Symbol</span>
          <input
            value={session.symbolInput}
            onChange={(event) => session.setSymbolInput(event.target.value.toUpperCase())}
            spellCheck={false}
            autoCapitalize="characters"
            aria-label="Underlying symbol"
          />
        </label>
        <button type="submit" className="btn primary">
          Load
        </button>
        <div className="pills" aria-label="Popular symbols">
          {session.popular.map((sym) => (
            <button
              key={sym}
              type="button"
              className={sym === session.symbol ? 'pill active' : 'pill'}
              onClick={() => session.submitSymbol(sym)}
            >
              {sym}
            </button>
          ))}
        </div>
        <label className="select-field">
          <span>Data</span>
          <select
            value={session.source}
            onChange={(event) => session.setSource(event.target.value as DataSource)}
          >
            {sources.map((src) => (
              <option key={src.id} value={src.id}>
                {src.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn" onClick={session.reload} disabled={session.loading}>
          {session.loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="toolbar-row wrap">
        <Segmented
          label="Expirations"
          value={session.expirationMode}
          options={EXP_MODES}
          onChange={session.setExpirationMode}
        />
        <Segmented label="GEX" value={session.gexView} options={VIEWS} onChange={session.setGexView} />
        <Segmented label="Units" value={session.unit} options={UNITS} onChange={session.setUnit} />
        <Segmented
          label="Strikes"
          value={session.strikeWindow}
          options={WINDOWS}
          onChange={session.setStrikeWindow}
        />
      </div>

      {session.expirationMode === 'custom' && (
        <div className="expiry-pills" aria-label="Expiration dates">
          {session.allExpirations.map((iso) => {
            const active = session.customExpirations.includes(iso)
            return (
              <button
                key={iso}
                type="button"
                className={active ? 'chip active' : 'chip'}
                onClick={() => {
                  session.setCustomExpirations((prev) =>
                    prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso],
                  )
                }}
              >
                {formatExpiryLong(iso, dte(iso))}
              </button>
            )
          })}
        </div>
      )}
    </form>
  )
}

function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { id: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="segmented">
      <span>{label}</span>
      <div role="group" aria-label={label}>
        {options.map((opt) => (
          <button
            key={String(opt.id)}
            type="button"
            className={opt.id === value ? 'active' : ''}
            onClick={() => onChange(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
