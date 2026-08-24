import { type CacheEntry, type CacheStore, isExpired, warnUnavailable } from '../types'
import { createMemoryStore } from './memory'

const STORAGE_PREFIX = 'flyreq:cache:'

function getLocalStorage(): Storage | undefined {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
      return (globalThis as { localStorage?: Storage }).localStorage
    }
  }
  catch {
    // ignore (e.g. disabled storage)
  }
  return undefined
}

/** Web Storage (localStorage) backend. */
export function createStorageStore(): CacheStore {
  const storage = getLocalStorage()
  if (!storage) {
    warnUnavailable('localStorage')
    return createMemoryStore()
  }

  function readEntry(key: string): CacheEntry | undefined {
    const raw = storage.getItem(STORAGE_PREFIX + key)
    if (!raw) return undefined
    try {
      return JSON.parse(raw) as CacheEntry
    }
    catch {
      storage.removeItem(STORAGE_PREFIX + key)
      return undefined
    }
  }

  return {
    async has(key) {
      const entry = readEntry(key)
      if (!entry) return false
      if (isExpired(entry.meta)) {
        storage.removeItem(STORAGE_PREFIX + key)
        return false
      }
      return true
    },
    async get<T>(key: string) {
      if (!(await this.has(key))) return undefined
      return readEntry(key)?.value as T | undefined
    },
    async set(key, value, meta) {
      const entry: CacheEntry = { value, meta }
      storage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry))
    },
    async delete(key) {
      storage.removeItem(STORAGE_PREFIX + key)
    },
    async clear() {
      const toRemove: string[] = []
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i)
        if (k?.startsWith(STORAGE_PREFIX)) toRemove.push(k)
      }
      for (const k of toRemove) storage.removeItem(k)
    },
  }
}
