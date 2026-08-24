import { describe, expect, it } from 'vitest'
import { createXhrRequestor } from '../src/index'

class MockXHR {
  method = ''
  url = ''
  timeout = 0
  status = 200
  statusText = 'OK'
  responseText = '{"hello":"world"}'
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  ontimeout: (() => void) | null = null
  private headers: Record<string, string> = {}

  open(method: string, url: string) {
    this.method = method
    this.url = url
  }

  setRequestHeader(key: string, value: string) {
    this.headers[key] = value
  }

  getAllResponseHeaders() {
    return 'content-type: application/json\r\nx-echo: 1'
  }

  getResponseHeader(name: string) {
    if (name.toLowerCase() === 'content-type') return 'application/json'
    return null
  }

  send(_body?: unknown) {
    queueMicrotask(() => this.onload?.())
  }

  abort() {}
}

describe('createXhrRequestor', () => {
  it('implements Requestor via XMLHttpRequest', async () => {
    const req = createXhrRequestor({
      XMLHttpRequest: MockXHR as unknown as typeof XMLHttpRequest,
    })
    const resp = await req.get('/ping', { params: { q: '1' } })
    expect(resp.status).toBe(200)
    expect(await resp.json()).toEqual({ hello: 'world' })
  })

  it('sends JSON body on POST', async () => {
    const req = createXhrRequestor({
      XMLHttpRequest: MockXHR as unknown as typeof XMLHttpRequest,
    })
    const resp = await req.post('/api/article', { title: 't' })
    expect(resp.ok).toBe(true)
  })
})
