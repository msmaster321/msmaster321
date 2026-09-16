export function toIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, 16, 0, 0, 0)
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function isWeekday(date: Date): boolean {
  const day = date.getDay()
  return day !== 0 && day !== 6
}

export function dte(expirationIso: string, now = new Date()): number {
  const exp = startOfDay(parseIsoDate(expirationIso))
  const today = startOfDay(now)
  return Math.round((exp.getTime() - today.getTime()) / 86_400_000)
}

/** Years to 4:00pm local on the expiration date, floored at 6 hours. */
export function timeToExpiryYears(expirationIso: string, now = new Date()): number {
  const exp = parseIsoDate(expirationIso)
  const years = (exp.getTime() - now.getTime()) / (365.25 * 24 * 3600 * 1000)
  return Math.max(years, 6 / (365.25 * 24))
}

export function thirdFriday(year: number, monthIndex: number): Date {
  const first = new Date(year, monthIndex, 1)
  const offset = (5 - first.getDay() + 7) % 7
  return new Date(year, monthIndex, 1 + offset + 14)
}

export function buildDemoExpirations(now: Date, hasZeroDte: boolean): string[] {
  const today = startOfDay(now)
  const dates = new Set<string>()

  if (hasZeroDte) {
    let cursor = today
    let added = 0
    while (added < 4) {
      if (isWeekday(cursor)) {
        dates.add(toIsoDate(cursor))
        added += 1
      }
      cursor = addDays(cursor, 1)
    }
  }

  let fridayCursor = today
  let fridays = 0
  while (fridays < 8) {
    if (fridayCursor.getDay() === 5) {
      dates.add(toIsoDate(fridayCursor))
      fridays += 1
    }
    fridayCursor = addDays(fridayCursor, 1)
  }

  for (let i = 0; i < 6; i++) {
    const month = today.getMonth() + i
    const year = today.getFullYear() + Math.floor(month / 12)
    const monthIndex = ((month % 12) + 12) % 12
    const monthly = thirdFriday(year, monthIndex)
    if (startOfDay(monthly) >= today) {
      dates.add(toIsoDate(monthly))
    }
  }

  return [...dates].sort()
}

export function formatExpiryTick(iso: string, days: number): string {
  const date = parseIsoDate(iso)
  const mon = date.toLocaleString('en-US', { month: 'short' })
  const day = date.getDate()
  if (days <= 0) return `${mon} ${day}\n0DTE`
  return `${mon} ${day}\n${days}D`
}

export function formatExpiryLong(iso: string, days: number): string {
  const date = parseIsoDate(iso)
  const label = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  if (days <= 0) return `${label} · 0DTE`
  return `${label} · ${days} DTE`
}
