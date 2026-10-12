// Merging and validating the fitness log. No imports, so the server (server/sync.ts) can share it.

export type DatedLog = Record<string, { updatedAt: number }>

/** Per-day merge: the newer record wins. */
export function mergeLogs<L extends DatedLog>(a: L, b: L): L {
  const out: DatedLog = { ...a }
  for (const [date, day] of Object.entries(b)) {
    if (!out[date] || day.updatedAt > out[date].updatedAt) out[date] = day
  }
  return out as L
}

export function isDatedLog(x: unknown): x is DatedLog {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false
  return Object.entries(x).every(
    ([k, v]) => /^\d{4}-\d{2}-\d{2}$/.test(k) && v != null && typeof v === 'object' && typeof (v as { updatedAt?: unknown }).updatedAt === 'number',
  )
}
