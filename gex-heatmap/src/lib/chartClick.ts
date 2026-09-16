export function readClickPayload(data: unknown): {
  strike: number
  expiration?: string
} | null {
  if (data === null || typeof data !== 'object') return null
  const rec = data as Record<string, unknown>
  const strike = typeof rec.strike === 'number' ? rec.strike : null
  const expiration = typeof rec.expiration === 'string' ? rec.expiration : undefined
  if (strike == null) return null
  return { strike, expiration }
}
