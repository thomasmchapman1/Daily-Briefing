// Thin, failure-tolerant localStorage wrapper. Storage can be unavailable
// (private mode, quota), so every access is guarded.

const PREFIX = 'morning:'

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw == null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Ignore: the app still works for this session.
  }
}
