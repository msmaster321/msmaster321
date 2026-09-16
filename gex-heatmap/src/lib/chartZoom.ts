export function categoryZoomAround(
  labels: string[],
  values: number[],
  center: number,
  visibleCount: number,
): { startValue: string; endValue: string } | { start: number; end: number } {
  if (labels.length === 0) return { start: 0, end: 100 }
  if (labels.length <= visibleCount) return { start: 0, end: 100 }

  const idx = values.reduce((best, value, i) => {
    const current = values[best] ?? value
    return Math.abs(value - center) < Math.abs(current - center) ? i : best
  }, 0)
  const half = Math.floor(visibleCount / 2)
  let from = Math.max(0, idx - half)
  let to = Math.min(labels.length - 1, from + visibleCount - 1)
  from = Math.max(0, to - visibleCount + 1)
  return {
    startValue: labels[from] ?? labels[0]!,
    endValue: labels[to] ?? labels[labels.length - 1]!,
  }
}
