import { describe, expect, it, beforeEach } from 'vitest'
import { resetRequestor, getRequestor } from '@flyreq/core'
import {
  setupFlyreq,
  setBackend,
  registerAdapter,
  listBackends,
  getBackend,
  createHttpResponse,
  type Requestor,
} from '../src/index'

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
})

describe('adapters', () => {
  it('lists builtin backends after setup', () => {
    setupFlyreq({ ignoreConfigFile: true, backend: 'fetch' })
    expect(listBackends()).toEqual(expect.arrayContaining(['axios', 'fetch', 'xhr']))
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
})
