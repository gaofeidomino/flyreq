import { type CacheEntry, type CacheStore, isExpired, warnUnavailable } from '../types'
import { createMemoryStore } from './memory'

const DB_NAME = 'flyreq-cache'
const STORE_NAME = 'entries'

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function withStore<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const tx = db.transaction(STORE_NAME, mode)
  return idbRequest(fn(tx.objectStore(STORE_NAME)))
}

/** IndexedDB backend. Falls back to memory when IndexedDB is missing. */
export function createIndexedDBStore(): CacheStore {
  if (typeof indexedDB === 'undefined') {
    warnUnavailable('IndexedDB')
    return createMemoryStore()
  }

  let dbPromise: Promise<IDBDatabase> | undefined
  const db = () => {
    dbPromise ??= openDB()
    return dbPromise
  }

  return {
    async has(key) {
      const database = await db()
      const entry = await withStore(database, 'readonly', (s) => s.get(key)) as CacheEntry | undefined
      if (!entry) return false
      if (isExpired(entry.meta)) {
        await withStore(database, 'readwrite', (s) => s.delete(key))
        return false
      }
      return true
    },
    async get<T>(key: string) {
      const database = await db()
      const entry = await withStore(database, 'readonly', (s) => s.get(key)) as CacheEntry | undefined
      if (!entry) return undefined
      if (isExpired(entry.meta)) {
        await withStore(database, 'readwrite', (s) => s.delete(key))
        return undefined
      }
      return entry.value as T
    },
    async set(key, value, meta) {
      const database = await db()
      const entry: CacheEntry = { value, meta }
      await withStore(database, 'readwrite', (s) => s.put(entry, key))
    },
    async delete(key) {
      const database = await db()
      await withStore(database, 'readwrite', (s) => s.delete(key))
    },
    async clear() {
      const database = await db()
      await withStore(database, 'readwrite', (s) => s.clear())
    },
  }
}
