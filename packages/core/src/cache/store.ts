import type { CacheStore } from './types'
import { createMemoryStore } from './stores/memory'
import { createStorageStore } from './stores/storage'
import { createIndexedDBStore } from './stores/indexeddb'
import { createServiceWorkerStore } from './stores/sw'
import { createWebSQLStore } from './stores/websql'
import { createCookieStore } from './stores/cookie'

export type { CacheStore, CacheMeta, CacheEntry } from './types'
export { createMemoryStore } from './stores/memory'
export { createStorageStore } from './stores/storage'
export { createIndexedDBStore } from './stores/indexeddb'
export { createServiceWorkerStore } from './stores/sw'
export { createWebSQLStore } from './stores/websql'
export { createCookieStore } from './stores/cookie'

/**
 * Store kinds from the persistence DIP diagram:
 * storage / indexeddb / SW / WebSQL / cookie / memory
 */
export type CacheStoreKind =
  | 'memory'
  | 'storage'
  | 'indexeddb'
  | 'sw'
  | 'websql'
  | 'cookie'

export function createCacheStore(kind: CacheStoreKind): CacheStore {
  switch (kind) {
    case 'memory':
      return createMemoryStore()
    case 'storage':
      return createStorageStore()
    case 'indexeddb':
      return createIndexedDBStore()
    case 'sw':
      return createServiceWorkerStore()
    case 'websql':
      return createWebSQLStore()
    case 'cookie':
      return createCookieStore()
    default: {
      const _exhaustive: never = kind
      throw new Error(`[flyreq] unknown cache store: ${String(_exhaustive)}`)
    }
  }
}

/**
 * Default factory from the spec: memory vs persist (Web Storage).
 * Also accepts a store kind to pick any CacheStore adapter.
 */
export function useCacheStore(persistOrKind: boolean | CacheStoreKind = false): CacheStore {
  if (persistOrKind === true) return createStorageStore()
  if (persistOrKind === false) return createMemoryStore()
  return createCacheStore(persistOrKind)
}
