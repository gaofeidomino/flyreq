/**
 * 场景：请求缓存
 *
 * createCacheRequestor 只依赖 CacheStore 接口；换存储实现不影响这段逻辑。
 */
import {
  createCacheRequestor,
  createMemoryStore,
  type CacheStore,
} from 'flyreq'
import { bootMock, heading, note } from '../mock'

export async function runCache(): Promise<void> {
  const mock = bootMock({ label: 'cache' })

  heading('1. 相同 GET 第二次走缓存')
  const cached = createCacheRequestor({ duration: 60_000 })
  await cached.get('/api/profile')
  await cached.get('/api/profile')
  note(`两次 get('/api/profile')，网络次数=${mock.calls.filter((c) => c.url === '/api/profile').length}（应为 1）`)

  heading('2. 自定义缓存键（只要 pathname，忽略 query）')
  const byPath = createCacheRequestor({
    duration: 60_000,
    key: (config) => config.url,
  })
  await byPath.get('/api/search', { params: { q: 'a' } })
  await byPath.get('/api/search', { params: { q: 'b' } })
  note(`不同 query 但 key=url → /api/search 网络次数=${mock.calls.filter((c) => c.url === '/api/search').length}（应为 1）`)

  heading('3. isValid：自定义失效（提供后 duration 无效）')
  let allowCache = true
  const gated = createCacheRequestor({
    isValid: () => allowCache,
  })
  await gated.get('/api/config')
  await gated.get('/api/config')
  note(`isValid=true 时 /api/config 网络=${mock.calls.filter((c) => c.url === '/api/config').length}`)
  allowCache = false
  await gated.get('/api/config')
  note(`isValid=false 后再请求，网络=${mock.calls.filter((c) => c.url === '/api/config').length}`)

  heading('4. 注入自定义 CacheStore（DIP）')
  const memory = createMemoryStore()
  const log: string[] = []
  const store: CacheStore = {
    async has(key) {
      log.push(`has:${key}`)
      return memory.has(key)
    },
    async get(key) {
      log.push(`get:${key}`)
      return memory.get(key)
    },
    async set(key, value, meta) {
      log.push(`set:${key}`)
      return memory.set(key, value, meta)
    },
    async delete(key) {
      return memory.delete(key)
    },
    async clear() {
      return memory.clear()
    },
  }
  const withStore = createCacheRequestor({ store, duration: 10_000 })
  await withStore.get('/api/custom-store')
  await withStore.get('/api/custom-store')
  note(`自定义 store 轨迹: ${log.join(' → ')}`)
  note('也可 storeKind: "memory" | "storage" | "indexeddb" | "sw" | "websql" | "cookie"')
}
