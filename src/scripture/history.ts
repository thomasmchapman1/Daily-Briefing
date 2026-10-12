// Read history is stored independently of the plan, so switching plans
// or translations never resets the streak.
import { addDays, isoDate } from '../lib/date'
import { load, save } from '../lib/storage'

export type ReadLog = Record<string, true>

export function loadReadLog(): ReadLog {
  return load<ReadLog>('readLog', {})
}

export function setRead(log: ReadLog, date: string, read: boolean): ReadLog {
  const next = { ...log }
  if (read) next[date] = true
  else delete next[date]
  save('readLog', next)
  return next
}

/** Consecutive days read, counting back from today (or yesterday if today isn't read yet). */
export function streak(log: ReadLog, today: Date): number {
  let n = 0
  let d = log[isoDate(today)] ? today : addDays(today, -1)
  while (log[isoDate(d)]) {
    n++
    d = addDays(d, -1)
  }
  return n
}
