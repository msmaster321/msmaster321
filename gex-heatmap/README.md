# GEX Heatmap

Desktop-friendly Gamma Exposure heatmap for visualizing dealer gamma across strikes and expirations. Classic GEX workflow for SPX/SPY/QQQ and single-stock options.

**Yahoo live options are the default.** Demo mode remains one click away if the live feed is unavailable.

## Quick start

```bash
cd gex-heatmap
npm install
npm run dev
```

Open the printed local URL (default `http://localhost:5173`). The first load fetches a **live Yahoo Finance** options chain for **SPY** (delayed quotes). If Yahoo fails, an amber banner shows the real error and a **Use demo data** button.

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

### Yahoo Finance (default live)

First load uses Yahoo delayed options. Copy `.env.example` if you want the env var explicit; **the UI still defaults to Yahoo when `.env.local` is missing**.

```bash
# gex-heatmap/.env.local  (optional — Yahoo is already the default)
VITE_DATA_SOURCE=yahoo
```

`npm run dev` runs a Vite plugin that:

1. Completes Yahoo’s cookie + crumb handshake (`fc.yahoo.com` → `/v1/test/getcrumb`)
2. Proxies `/api/yahoo/*` to `https://query1.finance.yahoo.com` with that crumb

The browser never talks to Yahoo directly, so there is no CORS issue. Yahoo does not always publish gammas; the app **recomputes Γ from listed IV**.

On failure the heatmap does **not** silently switch to demo. You get:

- an amber **LIVE FAILED** badge
- the real error text
- **Retry live** and **Use demo data**

A successful live load shows a green **Live · Yahoo** badge and the quote’s as-of time.

Yahoo’s options endpoint is unofficial and can rate-limit or require a fresh crumb. The proxy refreshes the session on 401.

The crumb handshake is part of the **dev/preview server**. A static `vite preview` without this plugin, or GitHub Pages hosting, cannot fetch live chains unless you put an equivalent proxy in front.

### Demo (manual fallback)

Toolbar **Data → Demo**, or the banner’s **Use demo data** button. Deterministic synthetic chain seeded by `symbol + calendar date`:

- Realistic expirations (0DTE/weeklies for indexes and major ETFs; weeklies + monthlies for single names).
- IV smile + put skew + term-structure bump for near-dated options.
- OI clustered around ATM, heavier on puts below spot and calls above, with round-strike bumps.

The blue banner and **DEMO** badge make it unambiguous that the chain is synthetic.

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
