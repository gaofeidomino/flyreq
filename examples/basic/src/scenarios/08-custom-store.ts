/**
 * 场景：自定义 CacheStore + 内置 storeKind
 *
 * 持久化层的 DIP：具体功能（缓存请求）只依赖统一接口。
 */
import {
  createCacheRequestor,
  createCacheStore,
  type CacheEntry,
  type CacheStore,
} from 'flyreq'
import { bootMock, heading, note } from '../mock'

/** 演示用：带前缀的内存表，实际项目可换成 Redis / IndexedDB 封装 */
function createPrefixedStore(prefix: string): CacheStore {
  const map = new Map<string, CacheEntry>()
  const k = (key: string) => `${prefix}${key}`
  return {
    async has(key) {
      return map.has(k(key))
    },
    async get(key) {
      return map.get(k(key))?.value
    },
    async set(key, value, meta) {
      map.set(k(key), { value, meta })
    },
    async delete(key) {
      map.delete(k(key))
    },
    async clear() {
      map.clear()
    },
  }
}

export async function runCustomStore(): Promise<void> {
  heading('1. 自己实现 CacheStore 再注入 createCacheRequestor')
  const mock = bootMock({ label: 'store' })
  const redisLike = createPrefixedStore('demo:')
  const req = createCacheRequestor({
    store: redisLike,
    duration: 60_000,
    key: (c) => c.url,
  })
  await req.get('/api/kv')
  await req.get('/api/kv')
  note(`自定义仓库命中，网络=${mock.calls.length}（应为 1）`)

  heading('2. storeKind / createCacheStore 选用内置方案')
  const viaKind = createCacheRequestor({
    storeKind: 'memory',
    duration: 5_000,
  })
  await viaKind.get('/api/kind')
  await viaKind.get('/api/kind')
  note(`/api/kind 网络=${mock.calls.filter((c) => c.url === '/api/kind').length}（应为 1）`)

  const builtin = createCacheStore('memory')
  await builtin.set('x', 1)
  note(`createCacheStore("memory").has("x")=${await builtin.has('x')}`)
  note('同接口还可: storage | indexeddb | sw | websql | cookie（环境没有则回退内存）')
}
