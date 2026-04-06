/**
 * Simple in-memory cache with TTL.
 * Data updates weekly — no need to hit the DB on every request.
 * Cache is per-process (resets on deploy).
 */

type CacheEntry<T> = {
  data: T
  expiresAt: number
}

const store = new Map<string, CacheEntry<unknown>>()

const DEFAULT_TTL_MS = 10 * 60 * 1000 // 10 minutes

export function cached<T>(key: string, fn: () => Promise<T>, ttlMs = DEFAULT_TTL_MS): Promise<T> {
  const entry = store.get(key) as CacheEntry<T> | undefined
  if (entry && Date.now() < entry.expiresAt) {
    return Promise.resolve(entry.data)
  }

  return fn().then((data) => {
    store.set(key, { data, expiresAt: Date.now() + ttlMs })
    return data
  })
}
