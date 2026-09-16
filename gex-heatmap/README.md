# GEX Heatmap

Desktop-friendly Gamma Exposure heatmap for visualizing dealer gamma across strikes and expirations. Classic GEX workflow for SPX/SPY/QQQ and single-stock options.

Demo mode works with no API keys. Optional live Yahoo Finance options (via the Vite dev proxy) or a custom chain API.

## Quick start

```bash
cd gex-heatmap
npm install
npm run dev
```

Open the printed local URL (default `http://localhost:5173`). The first load renders a synthetic **SPY** chain and heatmap immediately.

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server + Yahoo proxy |
| `npm run build` | Typecheck and production bundle |
| `npm run preview` | Serve the production build |

## What you get

- **Heatmap**: strikes (vertical) × expiration dates (horizontal), diverging red → dark → green color scale.
- **Overlays**: current spot (cyan) and estimated gamma-flip / zero-gamma (amber dashed).
- **Tooltips**: strike, expiration, net/call/put GEX, call/put open interest, gamma and IV.
- **Zoom / pan**: scroll the strike axis; click a cell or profile bar to inspect a strike.
- **Controls**: symbol, expiration window (all / nearest 4 / nearest 8 / custom dates), Call / Put / Net GEX, `$` GEX per **1% move** vs per **$1 move**, strike window, refresh.
- **Summary cards**: total net GEX, call GEX, put GEX, gamma flip, spot.
- **Strike profile**: net GEX aggregated across the selected expirations.

## GEX calculation

Per-share Black–Scholes gamma (identical for calls and puts):

```
φ(d1) = (1 / √(2π)) · exp(−d1² / 2)
d1    = [ln(S/K) + (r + σ²/2) T] / (σ √T)
Γ     = φ(d1) / (S · σ · √T)
```

Dollar gamma exposure for open interest:

```
GEX_1% = Γ · OI · M · S² · 0.01     # dollar GEX for a 1% move
GEX_$1 = Γ · OI · M · S             # dollar GEX for a $1 move
```

where `M` is the contract multiplier (100 for equity/ETF/index options in this app).

### Dealer sign convention

Retail GEX heatmaps following SqueezeMetrics / SpotGamma-style books treat **dealers as long calls and short puts**:

```
Call GEX = + GEX(Γ_call, Call OI)
Put GEX  = − GEX(Γ_put,  Put OI)
Net GEX  = Call GEX + Put GEX
```

- **Positive net GEX** (green): dealers are net long gamma. Hedging tends to **fade** moves (buy dips / sell rips) → pinning / vol suppression.
- **Negative net GEX** (red): dealers are net short gamma. Hedging tends to **amplify** moves (sell dips / buy rips).

This is a flow *assumption*, not a measured dealer inventory. Customer buy-write vs. crash-put demand can invert the book.

### Zero-gamma / flip level

The flip is the hypothetical spot `S*` where **total net GEX changes sign**, holding:

- implied volatility **sticky-strike** (listed IVs do not restrike),
- open interest fixed,
- rate `r = 4.5%`.

The app walks a grid of spots around the quote (`±18%`, 96 steps) and linearly interpolates the zero crossing closest to spot.

### Other modeling choices

| Choice | Default |
| --- | --- |
| Time to expiry | Years to 4:00pm *local* on the expiration date |
| 0DTE floor | `T ≥ 6 hours` so gamma does not explode after the cash close |
| Color scale | Symmetric around 0, clipped at the **93rd percentile** of \|GEX\| |
| Index symbols | `SPX` → `^SPX`, `NDX` → `^NDX` when using Yahoo |

## Data sources

### Demo (default)

Deterministic synthetic chain seeded by `symbol + calendar date`:

- Realistic expirations (0DTE/weeklies for indexes and major ETFs; weeklies + monthlies for single names).
- IV smile + put skew + term-structure bump for near-dated options.
- OI clustered around ATM, heavier on puts below spot and calls above, with round-strike bumps.

No network required. The blue banner states that the chain is synthetic.

### Yahoo Finance (optional live)

In the toolbar choose **Yahoo live**, or start with live data by default:

```bash
# gex-heatmap/.env.local
VITE_DATA_SOURCE=yahoo
```

The Vite dev server proxies ` /api/yahoo/* ` to `https://query2.finance.yahoo.com` to avoid browser CORS. Yahoo does not always publish gammas; the app **recomputes Γ from listed IV** with the formula above.

Yahoo’s options endpoint is unofficial, delayed, and can require cookies or return empty chains. **On any failure the app falls back to demo** and shows an amber banner with the error.

Live fetches are **not** available from `vite preview` / static hosting unless you put an equivalent proxy in front.

### Custom REST API

```bash
VITE_DATA_SOURCE=custom
VITE_OPTIONS_API_URL=https://your-api.example/options
```

`GET {VITE_OPTIONS_API_URL}?symbol=SPY` should return:

```json
{
  "symbol": "SPY",
  "spot": 642.35,
  "asOf": "2026-09-16T14:30:00Z",
  "multiplier": 100,
  "contracts": [
    {
      "expiration": "2026-09-18",
      "strike": 640,
      "type": "call",
      "openInterest": 18210,
      "impliedVolatility": 0.14,
      "gamma": 0.031
    }
  ]
}
```

`gamma` is optional. If omitted, it is computed from `impliedVolatility`. `type` may be `call` / `put` (or `C` / `P`).

## Interpretation cheatsheet

1. Find **spot** (cyan) and **flip** (amber). Below a long-gamma flip, dealer hedging can become destabilizing if the book is short gamma.
2. Bright vertical bands are expirations with a lot of gamma (often 0DTE / weekly / monthly).
3. Use **Call GEX / Put GEX** to see which side of the book is driving a strike.
4. The strike profile is the trader’s “magnet vs. air-pocket” view: large positive bars often act as pin candidates into expiry.

## Stack

React 19 + TypeScript + Vite, ECharts canvas heatmap/bars, dark trading-terminal UI.

This folder is the entire application. The repository root README is the GitHub profile page and is intentionally left intact.
