/**
 * 场景：请求缓存
 *
 * 日常用 flyreq.get(url, { cache: 60_000 })。
 * 自定义 CacheStore 仍可走 createCacheRequestor（DIP，不影响这段调用）。
 */
import {
  createCacheRequestor,
  createMemoryStore,
  flyreq,
  type CacheStore,
} from 'flyreq'
import { bootMock, heading, note } from '../mock'

export async function runCache(): Promise<void> {
  const mock = bootMock({ label: 'cache' })

  heading('1. 相同 GET 第二次走缓存')
  await flyreq.get('/api/profile', { cache: 60_000 })
  await flyreq.get('/api/profile', { cache: 60_000 })
  note(`两次 get('/api/profile')，网络次数=${mock.calls.filter(c => c.url === '/api/profile').length}（应为 1）`)

  heading('2. 自定义缓存键（只要 pathname，忽略 query）')
  await flyreq.get('/api/search', { params: { q: 'a' }, cache: { duration: 60_000, key: config => config.url } })
  await flyreq.get('/api/search', { params: { q: 'b' }, cache: { duration: 60_000, key: config => config.url } })
  note(`不同 query 但 key=url → /api/search 网络次数=${mock.calls.filter(c => c.url === '/api/search').length}（应为 1）`)

  heading('3. isValid：自定义失效（提供后 duration 无效）')
  let allowCache = true
  const gated = { isValid: () => allowCache }
  await flyreq.get('/api/config', { cache: gated })
  await flyreq.get('/api/config', { cache: gated })
  note(`isValid=true 时 /api/config 网络=${mock.calls.filter(c => c.url === '/api/config').length}`)
  allowCache = false
  await flyreq.get('/api/config', { cache: gated })
  note(`isValid=false 后再请求，网络=${mock.calls.filter(c => c.url === '/api/config').length}`)

  heading('4. 注入自定义 CacheStore（高级）')
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
