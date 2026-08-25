import { describe, expect, it, beforeEach } from 'vitest'
import {
  createHttpResponse,
  resetRequestor,
  type HttpResponse,
  type RequestConfig,
  type Requestor,
} from '@flyreq/core'
import {
  bootstrapRequestor,
  configureBus,
  configureFlyreq,
  flyreq,
  resetFlyreqClient,
  setRequestToken,
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
        data: { code: 0, data: { url: config.url, body: config.body, n: calls.length }, message: 'ok' },
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
  resetFlyreqClient()
  configureBus({ baseURL: 'https://api.example.com', successCode: 0, authHeader: 'Authorization' })
  setRequestToken(undefined)
})

describe('flyreq client', () => {
  it('get returns unwrapped envelope data without passing a Requestor', async () => {
    const { requestor } = createMockRequestor()
    bootstrapRequestor(requestor)
    const data = await flyreq.get<{ url: string }>('/api/user/me')
    expect(data.url).toBe('/api/user/me')
  })

  it('post sends body and unwraps data', async () => {
    const { requestor, calls } = createMockRequestor()
    bootstrapRequestor(requestor)
    const data = await flyreq.post<{ body: { title: string } }>('/api/article', { title: 'Hi' })
    expect(data.body).toEqual({ title: 'Hi' })
    expect(calls[0]?.method).toBe('POST')
  })

  it('retries when retry is set on the call', async () => {
    let n = 0
    const { requestor } = createMockRequestor(async () => {
      n++
      if (n < 3) throw new Error('fail')
      return createHttpResponse({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { code: 0, data: { n }, message: 'ok' },
        url: '/unstable',
      })
    })
    bootstrapRequestor(requestor)
    const data = await flyreq.get<{ n: number }>('/unstable', { retry: 5 })
    expect(data.n).toBe(3)
  })

  it('uses configureFlyreq retry as the default', async () => {
    let n = 0
    const { requestor } = createMockRequestor(async () => {
      n++
      if (n < 2) throw new Error('fail')
      return createHttpResponse({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { code: 0, data: { n }, message: 'ok' },
        url: '/unstable',
      })
    })
    bootstrapRequestor(requestor)
    configureFlyreq({ retry: 3 })
    const data = await flyreq.get<{ n: number }>('/unstable')
    expect(data.n).toBe(2)
  })

  it('caches a second identical GET when cache duration is set', async () => {
    const { requestor, calls } = createMockRequestor()
    bootstrapRequestor(requestor)
    await flyreq.get('/api/profile', { cache: 60_000 })
    await flyreq.get('/api/profile', { cache: 60_000 })
    expect(calls).toHaveLength(1)
  })

  it('dedupes identical POSTs when idempotent is true', async () => {
    const { requestor, calls } = createMockRequestor()
    bootstrapRequestor(requestor)
    await flyreq.post('/api/pay', { orderId: 1 }, { idempotent: true })
    await flyreq.post('/api/pay', { orderId: 1 }, { idempotent: true })
    expect(calls).toHaveLength(1)
    await flyreq.post('/api/pay', { orderId: 2 }, { idempotent: true })
    expect(calls).toHaveLength(2)
  })

  it('blocks a double-click that fires both requests at once', async () => {
    const { requestor, calls } = createMockRequestor(async (config) => {
      await new Promise((r) => setTimeout(r, 20))
      return createHttpResponse({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { code: 0, data: { url: config.url }, message: 'ok' },
        url: config.url,
      })
    })
    bootstrapRequestor(requestor)
    await Promise.all([
      flyreq.post('/api/pay', { orderId: 1 }, { idempotent: true }),
      flyreq.post('/api/pay', { orderId: 1 }, { idempotent: true }),
    ])
    expect(calls).toHaveLength(1)
  })

  it('lets the user retry after a business error instead of caching it', async () => {
    let n = 0
    const { requestor } = createMockRequestor(async (config) => {
      n++
      return createHttpResponse({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: n === 1
          ? { code: 500, data: null, message: '余额不足' }
          : { code: 0, data: { paid: true }, message: 'ok' },
        url: config.url,
      })
    })
    bootstrapRequestor(requestor)

    await expect(
      flyreq.post('/api/pay', { orderId: 1 }, { idempotent: true }),
    ).rejects.toThrow('余额不足')

    const second = await flyreq.post<{ paid: boolean }>('/api/pay', { orderId: 1 }, { idempotent: true })
    expect(second.paid).toBe(true)
  })

  it('does not serve a cached 500', async () => {
    const { requestor, calls } = createMockRequestor(async (config) =>
      createHttpResponse({ status: 500, statusText: 'Boom', headers: {}, data: null, url: config.url }),
    )
    bootstrapRequestor(requestor)
    await expect(flyreq.get('/boom', { cache: 60_000, retry: false })).rejects.toThrow('HTTP 500')
    await expect(flyreq.get('/boom', { cache: 60_000, retry: false })).rejects.toThrow('HTTP 500')
    expect(calls).toHaveLength(2)
  })

  it('exposes head and options', async () => {
    const { requestor, calls } = createMockRequestor()
    bootstrapRequestor(requestor)
    await flyreq.head('/api/ping')
    await flyreq.options('/api/ping')
    expect(calls.map((c) => c.method)).toEqual(['HEAD', 'OPTIONS'])
  })
})
