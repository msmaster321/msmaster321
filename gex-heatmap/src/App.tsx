import { HeatmapPanel } from './components/HeatmapPanel'
import { Inspector } from './components/Inspector'
import { ProfilePanel } from './components/ProfilePanel'
import { StatusBanner } from './components/StatusBanner'
import { SummaryCards } from './components/SummaryCards'
import { Toolbar } from './components/Toolbar'
import { useGexSession } from './hooks/useGexSession'
import { formatTime } from './lib/format'

export default function App() {
  const session = useGexSession()
  const view = session.view
  const snapshot = session.result?.snapshot ?? null
  const failed = Boolean(session.result?.error)

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Logo />
          <div>
            <strong>Gamma Exposure</strong>
            <span>Dealer GEX heatmap</span>
          </div>
        </div>
        <div className="top-meta">
          <SourceBadge
            source={session.source}
            snapshotSource={snapshot?.source ?? null}
            loading={session.loading}
            failed={failed}
          />
          {snapshot && (
            <span className="asof">as of {formatTime(snapshot.asOf)}</span>
          )}
        </div>
      </header>

      <StatusBanner
        result={session.result}
        loading={session.loading}
        source={session.source}
        symbol={session.symbol}
        onUseDemo={session.useDemo}
        onRetry={session.reload}
      />
      <Toolbar session={session} />

      {view ? (
        <>
          <SummaryCards view={view} />
          <div className={`workspace${session.loading ? ' is-loading' : ''}`}>
            <HeatmapPanel
              view={view}
              selectedStrike={session.selectedStrike}
              selectedExpiration={session.selectedExpiration}
              onInspect={session.inspect}
            />
            <ProfilePanel
              view={view}
              selectedStrike={session.selectedStrike}
              onInspect={(strike) => session.inspect(strike)}
            />
          </div>
          {session.selectedStrike != null && (
            <Inspector
              view={view}
              strike={session.selectedStrike}
              expiration={session.selectedExpiration}
              onClose={session.clearInspect}
            />
          )}
        </>
      ) : (
        <div className="workspace">
          <section className="panel">
            <div className="empty">
              {failed
                ? 'Live chain unavailable. Retry Yahoo or load demo data to render the heatmap.'
                : session.loading
                  ? `Building live GEX surface for ${session.symbol}…`
                  : 'No options chain loaded.'}
            </div>
          </section>
        </div>
      )}

      <footer className="foot">
        Dealers modeled as long calls / short puts with sticky-strike IV. Heatmap color is
        clipped to the 93rd percentile so a few monthly strikes do not wash out the surface.
        Not trading advice.
      </footer>
    </div>
  )
}

function SourceBadge({
  source,
  snapshotSource,
  loading,
  failed,
}: {
  source: string
  snapshotSource: string | null
  loading: boolean
  failed: boolean
}) {
  if (failed && snapshotSource == null) {
    return <span className="source-chip failed">LIVE FAILED</span>
  }
  if (loading && snapshotSource == null) {
    return <span className="source-chip loading">LOADING LIVE</span>
  }
  if (snapshotSource === 'yahoo') {
    return <span className="source-chip live">Live · Yahoo</span>
  }
  if (snapshotSource === 'custom') {
    return <span className="source-chip live">Live · Custom</span>
  }
  if (snapshotSource === 'demo') {
    return <span className="source-chip demo">DEMO</span>
  }
  return <span className="source-chip">{source.toUpperCase()}</span>
}

function Logo() {
  return (
    <svg className="logo" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#121821" />
      <rect x="4" y="19" width="5" height="9" rx="1" fill="#dc2626" />
      <rect x="10" y="14" width="5" height="14" rx="1" fill="#f87171" />
      <rect x="16" y="12" width="5" height="16" rx="1" fill="#334155" />
      <rect x="22" y="6" width="5" height="22" rx="1" fill="#22c55e" />
    </svg>
  )
}
