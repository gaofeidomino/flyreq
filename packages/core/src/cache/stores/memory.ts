import { type CacheEntry, type CacheStore, isExpired } from '../types'

export function createMemoryStore(): CacheStore {
  const map = new Map<string, CacheEntry>()

  return {
    async has(key) {
      const entry = map.get(key)
      if (!entry) return false
      if (isExpired(entry.meta)) {
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
