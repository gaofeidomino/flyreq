import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  createCacheStore,
  createMemoryStore,
  createStorageStore,
  resolveCacheStore,
  type CacheStore,
} from '../src/index'

function installLocalStorage() {
  const map = new Map<string, string>()
  const storage: Storage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v) },
    removeItem: (k: string) => { map.delete(k) },
    clear: () => { map.clear() },
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() { return map.size },
  }
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })
  return storage
}

async function assertStoreContract(store: CacheStore) {
  expect(await store.has('k')).toBe(false)
  await store.set('k', { v: 1 })
  expect(await store.has('k')).toBe(true)
  expect(await store.get('k')).toEqual({ v: 1 })
  await store.delete('k')
  expect(await store.has('k')).toBe(false)
  await store.set('a', 1)
  await store.set('b', 2)
  await store.clear()
  expect(await store.has('a')).toBe(false)
}

describe('CacheStore DIP', () => {
  it('resolveCacheStore(false) is memory', async () => {
    const store = resolveCacheStore(false)
    await assertStoreContract(store)
  })

  it('createCacheStore("memory") implements the unified interface', async () => {
    await assertStoreContract(createCacheStore('memory'))
  })

  describe('storage', () => {
    beforeEach(() => {
      installLocalStorage()
    })
    afterEach(() => {
      Reflect.deleteProperty(globalThis, 'localStorage')
    })

    it('createStorageStore persists via localStorage', async () => {
      await assertStoreContract(createStorageStore())
    })

    it('resolveCacheStore(true) uses storage', async () => {
      await assertStoreContract(resolveCacheStore(true))
    })
  })

  it('unavailable browser stores fall back to memory', async () => {
    const kinds = ['indexeddb', 'sw', 'websql', 'cookie'] as const
    for (const kind of kinds) {
      await assertStoreContract(createCacheStore(kind))
    }
  })

  it('createMemoryStore honours expireAt', async () => {
    const store = createMemoryStore()
    await store.set('k', 1, { expireAt: Date.now() - 1 })
    expect(await store.has('k')).toBe(false)
  })
})
