const INV_SQRT_2PI = 1 / Math.sqrt(2 * Math.PI)

export function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) * INV_SQRT_2PI
}

/**
 * Black–Scholes gamma (calls and puts share the same gamma).
 * Units: change in delta per $1 move in the underlying, per share.
 */
export function bsGamma(
  spot: number,
  strike: number,
  tYears: number,
  iv: number,
  rate = 0.045,
): number {
  if (!(spot > 0) || !(strike > 0) || !(iv > 0)) return 0
  const t = Math.max(tYears, 6 / (365.25 * 24))
  const sigma = Math.max(iv, 0.01)
  const sqrtT = Math.sqrt(t)
  const d1 =
    (Math.log(spot / strike) + (rate + 0.5 * sigma * sigma) * t) /
    (sigma * sqrtT)
  return normPdf(d1) / (spot * sigma * sqrtT)
}
