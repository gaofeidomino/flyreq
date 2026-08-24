import { describe, expect, it, beforeEach } from 'vitest'
import {
  createCacheRequestor,
  createHttpResponse,
  createIdempotentRequestor,
  createParallelRequestor,
  createRetryRequestor,
  createSerialRequestor,
  createMemoryStore,
  hashRequest,
  inject,
  resetRequestor,
  useRequestor,
  type HttpResponse,
  type RequestConfig,
  type Requestor,
} from '../src/index'

function createMockRequestor(handler?: (config: RequestConfig) => Promise<HttpResponse> | HttpResponse): {
  requestor: Requestor
  calls: RequestConfig[]
} {
  const calls: RequestConfig[] = []
  const requestor: Requestor = {
    async request(config) {
      calls.push(config)
      if (handler) return handler(config)
      return createHttpResponse({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { ok: true, n: calls.length },
        url: config.url,
      })
    },
    get(url, options) {
      return this.request({ method: 'GET', url, ...options })
    },
    post(url, data, options) {
      return this.request({ method: 'POST', url, body: data, ...options })
    },
    put(url, data, options) {
      return this.request({ method: 'PUT', url, body: data, ...options })
    },
    patch(url, data, options) {
      return this.request({ method: 'PATCH', url, body: data, ...options })
    },
    delete(url, options) {
      return this.request({ method: 'DELETE', url, ...options })
    },
  }
  return { requestor, calls }
}

beforeEach(() => {
  resetRequestor()
})

describe('inject', () => {
  it('throws when not injected', () => {
    expect(() => useRequestor()).toThrow(/No Requestor injected/)
  })

  it('returns injected requestor', () => {
    const { requestor } = createMockRequestor()
    inject(requestor)
    expect(useRequestor()).toBe(requestor)
  })
})

describe('createCacheRequestor', () => {
  it('caches by default key', async () => {
    const { requestor, calls } = createMockRequestor()
    inject(requestor)
    const cached = createCacheRequestor()
    const a = await cached.get('/a')
    const b = await cached.get('/a')
    expect(calls).toHaveLength(1)
    expect(await a.json()).toEqual(await b.json())
  })

  it('respects duration expiry via store', async () => {
    const store = createMemoryStore()
    const { requestor, calls } = createMockRequestor()
    inject(requestor)
    const cached = createCacheRequestor({ duration: 50, store })
    await cached.get('/x')
    await cached.get('/x')
    expect(calls).toHaveLength(1)
    await new Promise((r) => setTimeout(r, 60))
    await cached.get('/x')
    expect(calls).toHaveLength(2)
  })
})

describe('createIdempotentRequestor', () => {
  it('dedupes identical requests via hash', async () => {
    const { requestor, calls } = createMockRequestor()
    inject(requestor)
    const idem = createIdempotentRequestor()
    await idem.post('/pay', { orderId: 1 })
    await idem.post('/pay', { orderId: 1 })
    expect(calls).toHaveLength(1)
    await idem.post('/pay', { orderId: 2 })
    expect(calls).toHaveLength(2)
  })
})

describe('hashRequest', () => {
  it('is stable for same config', () => {
    const a: RequestConfig = { method: 'POST', url: '/a', body: { z: 1, a: 2 }, headers: { b: '1', a: '2' } }
    const b: RequestConfig = { method: 'POST', url: '/a', body: { a: 2, z: 1 }, headers: { a: '2', b: '1' } }
    expect(hashRequest(a)).toBe(hashRequest(b))
  })
})

describe('createRetryRequestor', () => {
  it('retries until success', async () => {
    let n = 0
    const { requestor } = createMockRequestor(async () => {
      n++
      if (n < 3) throw new Error('fail')
      return createHttpResponse({ status: 200, statusText: 'OK', headers: {}, data: n, url: '/' })
    })
    inject(requestor)
    const retry = createRetryRequestor(5)
    const resp = await retry.get('/')
    expect(await resp.json()).toBe(3)
  })
})

describe('createParallelRequestor', () => {
  it('limits concurrency', async () => {
    let active = 0
    let maxActive = 0
    const { requestor } = createMockRequestor(async () => {
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise((r) => setTimeout(r, 30))
      active--
      return createHttpResponse({ status: 200, statusText: 'OK', headers: {}, data: null, url: '/' })
    })
    inject(requestor)
    const parallel = createParallelRequestor({ maxCount: 2 })
    await Promise.all([parallel.get('/1'), parallel.get('/2'), parallel.get('/3'), parallel.get('/4')])
    expect(maxActive).toBeLessThanOrEqual(2)
  })
})

describe('createSerialRequestor', () => {
  it('runs requests in order', async () => {
    const order: number[] = []
    const { requestor } = createMockRequestor(async (config) => {
      const id = Number(config.url)
      await new Promise((r) => setTimeout(r, 20 - id * 5))
      order.push(id)
      return createHttpResponse({ status: 200, statusText: 'OK', headers: {}, data: id, url: config.url })
    })
    inject(requestor)
    const serial = createSerialRequestor()
    await Promise.all([serial.get('1'), serial.get('2'), serial.get('3')])
    expect(order).toEqual([1, 2, 3])
  })
})

describe('createMemoryStore', () => {
  it('set/get/has/delete', async () => {
    const store = createMemoryStore()
    expect(await store.has('k')).toBe(false)
    await store.set('k', { v: 1 })
    expect(await store.has('k')).toBe(true)
    expect(await store.get('k')).toEqual({ v: 1 })
    await store.delete('k')
    expect(await store.has('k')).toBe(false)
  })
})
