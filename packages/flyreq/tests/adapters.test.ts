import { describe, expect, it, beforeEach } from 'vitest'
import { resetRequestor, getRequestor } from '@flyreq/core'
import {
  setupFlyreq,
  setBackend,
  registerAdapter,
  listBackends,
  getBackend,
  createHttpResponse,
  flyreq,
  resetFlyreqClient,
  type RequestConfig,
  type Requestor,
} from '../src/index'
import { registerAxiosAdapter } from '../src/axios'

function createEcho(label: string): Requestor {
  return {
    async request(config) {
      return createHttpResponse({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { code: 0, data: { label, url: config.url }, message: 'ok' },
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
}

beforeEach(() => {
  resetRequestor()
  resetFlyreqClient()
})

describe('adapters', () => {
  it('builds in only the dependency-free transports', () => {
    setupFlyreq({ backend: 'fetch' })
    expect(listBackends()).toEqual(expect.arrayContaining(['fetch', 'xhr']))
    expect(listBackends()).not.toContain('axios')
    expect(getBackend()).toBe('fetch')
  })

  it('defaults to fetch so axios stays out of the bundle', () => {
    setupFlyreq({ baseURL: 'https://x.test' })
    expect(getBackend()).toBe('fetch')
  })

  it('registerAdapter + setBackend custom', async () => {
    registerAdapter('echo', () => createEcho('echo'))
    setBackend('echo')
    expect(getBackend()).toBe('echo')
    const resp = await getRequestor().get('/x')
    expect(await resp.json()).toMatchObject({ code: 0, data: { label: 'echo' } })
  })

  it('setBackend accepts Requestor instance', async () => {
    setBackend(createEcho('direct'))
    expect(getBackend()).toBe('custom')
    const resp = await getRequestor().get('/y')
    const body = await resp.json<{ data: { label: string } }>()
    expect(body.data.label).toBe('direct')
  })

  it('setupFlyreq token is sent on flyreq.get', async () => {
    const calls: RequestConfig[] = []
    registerAdapter('echo', () => ({
      ...createEcho('tok'),
      async request(config) {
        calls.push(config)
        return createEcho('tok').request(config)
      },
    }))
    setupFlyreq({
      backend: 'echo',
      token: 'abc',
    })
    const data = await flyreq.get<{ label: string }>('/me')
    expect(data.label).toBe('tok')
    expect(calls[0]?.headers?.Authorization).toBe('Bearer abc')
  })
})

/**
 * The adapter registry is process-wide with no reset, so registering axios is
 * one-way. Keep this block last: earlier tests assert axios is absent.
 */
describe('axios opt-in (mutates the shared registry)', () => {
  it('names the fix when axios is selected but not registered', () => {
    expect(listBackends()).not.toContain('axios')
    expect(() => setBackend('axios')).toThrowError(/flyreq\/axios/)
  })

  it('registerAxiosAdapter makes the name resolvable', () => {
    registerAxiosAdapter()
    expect(listBackends()).toContain('axios')
    setupFlyreq({ backend: 'axios' })
    expect(getBackend()).toBe('axios')
  })
})
