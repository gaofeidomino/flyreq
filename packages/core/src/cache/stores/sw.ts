import { type CacheEntry, type CacheStore, isExpired, warnUnavailable } from '../types'
import { createMemoryStore } from './memory'

const CACHE_NAME = 'flyreq-cache'
const KEY_ORIGIN = 'https://flyreq.local/cache/'

function toRequest(key: string): Request {
  return new Request(KEY_ORIGIN + encodeURIComponent(key))
}

async function readEntry(cache: Cache, key: string): Promise<CacheEntry | undefined> {
  const match = await cache.match(toRequest(key))
  if (!match) return undefined
  try {
    return (await match.json()) as CacheEntry
  }
  catch {
    await cache.delete(toRequest(key))
    return undefined
  }
}

/** Service Worker Cache API backend. */
export function createServiceWorkerStore(): CacheStore {
  if (typeof caches === 'undefined') {
    warnUnavailable('Cache API (SW)')
    return createMemoryStore()
  }

  const open = () => caches.open(CACHE_NAME)

  return {
    async has(key) {
      const cache = await open()
      const entry = await readEntry(cache, key)
      if (!entry) return false
      if (isExpired(entry.meta)) {
        await cache.delete(toRequest(key))
        return false
      }
      return true
    },
    async get<T>(key: string) {
      const cache = await open()
      const entry = await readEntry(cache, key)
      if (!entry) return undefined
      if (isExpired(entry.meta)) {
        await cache.delete(toRequest(key))
        return undefined
      }
      return entry.value as T
    },
    async set(key, value, meta) {
      const cache = await open()
      const entry: CacheEntry = { value, meta }
      await cache.put(
        toRequest(key),
        new Response(JSON.stringify(entry), {
          headers: { 'content-type': 'application/json' },
        }),
      )
    },
    async delete(key) {
      const cache = await open()
      await cache.delete(toRequest(key))
    },
    async clear() {
      await caches.delete(CACHE_NAME)
    },
  }
}
