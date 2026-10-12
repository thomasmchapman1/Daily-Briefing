import { useCallback, useEffect, useRef, useState } from 'react'
import { load, save } from '../lib/storage'
import { SEED, isValidLog, mergeLogs, type DayLog, type FitnessLog } from './log'

export type SyncStatus =
  | { state: 'off' }
  | { state: 'syncing' }
  | { state: 'synced'; at: number }
  | { state: 'error'; message: string }

const STORAGE_KEY = 'fitness'

export function loadLog(): FitnessLog {
  const stored = load<unknown>(STORAGE_KEY, null)
  return isValidLog(stored) ? mergeLogs(SEED, stored) : SEED
}

/** Sends the whole log; the server merges by day and returns the result. */
async function pushLog(log: FitnessLog, key: string): Promise<FitnessLog> {
  const res = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Sync-Key': key },
    body: JSON.stringify({ log }),
  })
  const json = (await res.json().catch(() => ({}))) as { log?: unknown; error?: string }
  if (!res.ok || !isValidLog(json.log)) throw new Error(json.error ?? `Sync failed (${res.status})`)
  return json.log
}

/**
 * The fitness log, saved to this device on every change. With a sync passcode it
 * also syncs with the cloud: on open, when the app comes back to the foreground,
 * and a moment after each edit.
 */
export function useFitnessLog(syncKey: string) {
  const [log, setLog] = useState<FitnessLog>(loadLog)
  const [sync, setSync] = useState<SyncStatus>({ state: syncKey ? 'syncing' : 'off' })
  const logRef = useRef(log)
  logRef.current = log
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const commit = useCallback((next: FitnessLog) => {
    save(STORAGE_KEY, next)
    setLog(next)
  }, [])

  const syncNow = useCallback(async () => {
    if (!syncKey) return setSync({ state: 'off' })
    setSync({ state: 'syncing' })
    try {
      const remote = await pushLog(logRef.current, syncKey)
      // Keep any edit made while the request was in flight.
      setLog((prev) => {
        const next = mergeLogs(prev, remote)
        save(STORAGE_KEY, next)
        return next
      })
      setSync({ state: 'synced', at: Date.now() })
    } catch (err) {
      setSync({ state: 'error', message: err instanceof Error ? err.message : 'Sync failed' })
    }
  }, [syncKey])

  useEffect(() => {
    void syncNow()
    const onVisible = () => document.visibilityState === 'visible' && void syncNow()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [syncNow])

  const scheduleSync = useCallback(() => {
    if (!syncKey) return
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void syncNow(), 1500)
  }, [syncKey, syncNow])

  const updateDay = useCallback(
    (date: string, change: (day: DayLog) => Omit<DayLog, 'updatedAt'>) => {
      const prev = logRef.current
      const day = prev[date] ?? { updatedAt: 0 }
      const next = { ...prev, [date]: { ...change(day), updatedAt: Date.now() } }
      logRef.current = next
      commit(next)
      scheduleSync()
    },
    [commit, scheduleSync],
  )

  /** Merge a backup file into the log (newer days win). */
  const importLog = useCallback(
    (incoming: FitnessLog) => {
      const next = mergeLogs(logRef.current, incoming)
      logRef.current = next
      commit(next)
      scheduleSync()
    },
    [commit, scheduleSync],
  )

  return { log, updateDay, importLog, sync, syncNow }
}
