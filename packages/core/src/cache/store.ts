export interface CacheMeta {
  expireAt?: number
}

export interface CacheEntry<T = unknown> {
  value: T
  meta?: CacheMeta
}

export interface CacheStore {
  has(key: string): Promise<boolean>
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, value: T, meta?: CacheMeta): Promise<void>
  delete(key: string): Promise<void>
  clear(): Promise<void>
}

export function createMemoryStore(): CacheStore {
  const map = new Map<string, CacheEntry>()

  return {
    async has(key) {
      const entry = map.get(key)
      if (!entry) return false
      if (entry.meta?.expireAt != null && Date.now() > entry.meta.expireAt) {
        map.delete(key)
        return false
      }
      return true
    },
    async get<T>(key: string) {
      if (!(await this.has(key))) return undefined
      return map.get(key)?.value as T | undefined
    },
    async set(key, value, meta) {
      map.set(key, { value, meta })
    },
    async delete(key) {
      map.delete(key)
    },
    async clear() {
      map.clear()
    },
  }
}

const STORAGE_PREFIX = 'flyreq:cache:'

function getLocalStorage(): Storage | undefined {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
      return (globalThis as { localStorage?: Storage }).localStorage
    }
  }
  catch {
    // ignore
  }
  return undefined
}

export function createStorageStore(): CacheStore {
  const storage = getLocalStorage()
  if (!storage) {
    console.warn('[flyreq] localStorage unavailable; falling back to memory cache store')
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
      if (entry.meta?.expireAt != null && Date.now() > entry.meta.expireAt) {
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

export function useCacheStore(persist: boolean): CacheStore {
  return persist ? createStorageStore() : createMemoryStore()
}
