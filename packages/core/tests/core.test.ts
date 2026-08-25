import { describe, expect, it, beforeEach } from 'vitest'
import {
  buildConfig,
  createCacheRequestor,
  createHttpResponse,
  createIdempotentRequestor,
  createParallelRequestor,
  createRetryRequestor,
  createSerialRequestor,
  createMemoryStore,
  hashRequest,
  injectRequestor,
  pathnameOf,
  resetRequestor,
  getRequestor,
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

describe('injectRequestor', () => {
  it('throws when not injected', () => {
    expect(() => getRequestor()).toThrow(/No Requestor injected/)
  })

  it('returns injected requestor', () => {
    const { requestor } = createMockRequestor()
    injectRequestor(requestor)
    expect(getRequestor()).toBe(requestor)
  })
})

describe('createCacheRequestor', () => {
  it('caches by default key', async () => {
    const { requestor, calls } = createMockRequestor()
    injectRequestor(requestor)
    const cached = createCacheRequestor()
    const a = await cached.get('/a')
    const b = await cached.get('/a')
    expect(calls).toHaveLength(1)
    expect(await a.json()).toEqual(await b.json())
  })

  it('does not cache a failed response', async () => {
    const { requestor, calls } = createMockRequestor(async (config) =>
      createHttpResponse({ status: 500, statusText: 'Boom', headers: {}, data: null, url: config.url }),
    )
    injectRequestor(requestor)
    const cached = createCacheRequestor({ duration: 60_000 })
    await cached.get('/boom')
    await cached.get('/boom')
    expect(calls).toHaveLength(2)
  })

  it('shares one in-flight request between concurrent callers', async () => {
    const { requestor, calls } = createMockRequestor(async (config) => {
      await new Promise((r) => setTimeout(r, 20))
      return createHttpResponse({ status: 200, statusText: 'OK', headers: {}, data: calls.length, url: config.url })
    })
    injectRequestor(requestor)
    const cached = createCacheRequestor()
    await Promise.all([cached.get('/same'), cached.get('/same')])
    expect(calls).toHaveLength(1)
  })

  it('respects duration expiry via store', async () => {
    const store = createMemoryStore()
    const { requestor, calls } = createMockRequestor()
    injectRequestor(requestor)
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
    injectRequestor(requestor)
    const idem = createIdempotentRequestor()
    await idem.post('/pay', { orderId: 1 })
    await idem.post('/pay', { orderId: 1 })
    expect(calls).toHaveLength(1)
    await idem.post('/pay', { orderId: 2 })
    expect(calls).toHaveLength(2)
  })

  it('blocks a concurrent double-submit', async () => {
    const { requestor, calls } = createMockRequestor(async (config) => {
      await new Promise((r) => setTimeout(r, 20))
      return createHttpResponse({ status: 200, statusText: 'OK', headers: {}, data: null, url: config.url })
    })
    injectRequestor(requestor)
    const idem = createIdempotentRequestor()
    await Promise.all([
      idem.post('/pay', { orderId: 1 }),
      idem.post('/pay', { orderId: 1 }),
    ])
    expect(calls).toHaveLength(1)
  })

  it('stops deduping once the window expires', async () => {
    const { requestor, calls } = createMockRequestor()
    injectRequestor(requestor)
    const idem = createIdempotentRequestor({ duration: 50 })
    await idem.post('/pay', { orderId: 1 })
    await idem.post('/pay', { orderId: 1 })
    expect(calls).toHaveLength(1)
    await new Promise((r) => setTimeout(r, 60))
    await idem.post('/pay', { orderId: 1 })
    expect(calls).toHaveLength(2)
  })
})

describe('hashRequest', () => {
  it('is stable for same config', () => {
    const a: RequestConfig = { method: 'POST', url: '/a', body: { z: 1, a: 2 }, headers: { b: '1', a: '2' } }
    const b: RequestConfig = { method: 'POST', url: '/a', body: { a: 2, z: 1 }, headers: { a: '2', b: '1' } }
    expect(hashRequest(a)).toBe(hashRequest(b))
  })

  it('produces 128-bit keys that differ per method and body', () => {
    const base: RequestConfig = { method: 'POST', url: '/pay', body: { orderId: 1 } }
    const hash = hashRequest(base)
    expect(hash).toMatch(/^[0-9a-f]{32}$/)
    expect(hashRequest({ ...base, method: 'PUT' })).not.toBe(hash)
    expect(hashRequest({ ...base, body: { orderId: 2 } })).not.toBe(hash)
  })
})

describe('pathnameOf', () => {
  it('strips query, hash and origin', () => {
    expect(pathnameOf('/api/article?page=1#top')).toBe('/api/article')
    expect(pathnameOf('https://x.dev/api/article?page=1')).toBe('/api/article')
    expect(pathnameOf('https://x.dev')).toBe('/')
  })

  it('is available on configs built by the library', () => {
    expect(buildConfig('GET', '/api/article?page=1').pathname).toBe('/api/article')
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
    injectRequestor(requestor)
    const retry = createRetryRequestor(5)
    const resp = await retry.get('/')
    expect(await resp.json()).toBe(3)
  })

  it('retries 5xx responses the transport resolved', async () => {
    let n = 0
    const { requestor } = createMockRequestor(async () => {
      n++
      const status = n < 3 ? 500 : 200
      return createHttpResponse({ status, statusText: 'x', headers: {}, data: n, url: '/' })
    })
    injectRequestor(requestor)
    const resp = await createRetryRequestor(5).get('/')
    expect(resp.status).toBe(200)
    expect(await resp.json()).toBe(3)
  })

  it('gives up and returns the last response when retries run out', async () => {
    const { requestor, calls } = createMockRequestor(async () =>
      createHttpResponse({ status: 503, statusText: 'x', headers: {}, data: null, url: '/' }),
    )
    injectRequestor(requestor)
    const resp = await createRetryRequestor(2).get('/')
    expect(resp.status).toBe(503)
    expect(calls).toHaveLength(3)
  })

  it('leaves 4xx alone', async () => {
    const { requestor, calls } = createMockRequestor(async () =>
      createHttpResponse({ status: 404, statusText: 'x', headers: {}, data: null, url: '/' }),
    )
    injectRequestor(requestor)
    const resp = await createRetryRequestor(5).get('/')
    expect(resp.status).toBe(404)
    expect(calls).toHaveLength(1)
  })

  it('shouldRetryResponse: false restores throw-only retrying', async () => {
    const { requestor, calls } = createMockRequestor(async () =>
      createHttpResponse({ status: 500, statusText: 'x', headers: {}, data: null, url: '/' }),
    )
    injectRequestor(requestor)
    const retry = createRetryRequestor({ maxCount: 5, shouldRetryResponse: false })
    const resp = await retry.get('/')
    expect(resp.status).toBe(500)
    expect(calls).toHaveLength(1)
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
    injectRequestor(requestor)
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
    injectRequestor(requestor)
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
