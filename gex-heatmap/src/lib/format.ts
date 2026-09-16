export function formatUsdCompact(value: number, signed = true): string {
  const sign = value < 0 ? '−' : value > 0 && signed ? '+' : ''
  const abs = Math.abs(value)
  let body: string
  if (abs >= 1e12) body = `${(abs / 1e12).toFixed(2)}T`
  else if (abs >= 1e9) body = `${(abs / 1e9).toFixed(2)}B`
  else if (abs >= 1e6) body = `${(abs / 1e6).toFixed(2)}M`
  else if (abs >= 1e3) body = `${(abs / 1e3).toFixed(1)}K`
  else body = abs.toFixed(0)
  return `${sign}$${body}`
}

export function formatUsdFull(value: number): string {
  const sign = value < 0 ? '−' : value > 0 ? '+' : ''
  return `${sign}$${Math.abs(value).toLocaleString('en-US', {
    maximumFractionDigits: 0,
  })}`
}

export function formatStrike(strike: number): string {
  if (Number.isInteger(strike)) return strike.toFixed(0)
  return strike.toFixed(strike < 50 ? 2 : 1)
}

export function formatPrice(price: number): string {
  return price.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatOi(value: number): string {
  return Math.round(value).toLocaleString('en-US')
}

export function formatIv(iv: number): string {
  return `${(iv * 100).toFixed(1)}%`
}

export function formatGamma(gamma: number): string {
  if (Math.abs(gamma) >= 0.1) return gamma.toFixed(3)
  if (Math.abs(gamma) >= 0.01) return gamma.toFixed(4)
  return gamma.toFixed(5)
}

export function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  })
}

export function signedClass(value: number): string {
  if (value > 0) return 'pos'
  if (value < 0) return 'neg'
  return 'muted'
}
