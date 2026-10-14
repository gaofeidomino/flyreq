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

describe('XHR error and cancellation paths',()=>{
 it.each(['error','timeout'])('rejects %s',async event=>{
  class FailingXHR extends MockXHR { override send(): void { queueMicrotask(()=>event==='error'?this.onerror?.():this.ontimeout?.()) } }
  const req=createXhrRequestor({XMLHttpRequest:FailingXHR as unknown as typeof XMLHttpRequest})
  await expect(req.get('/')).rejects.toThrow(event==='error'?'network':'timeout')
 })
 it.each([true,false])('supports pre-aborted=%s signals',async pre=>{
  class WaitingXHR extends MockXHR { override send(): void {} }
  const controller=new AbortController();if(pre)controller.abort()
  const req=createXhrRequestor({XMLHttpRequest:WaitingXHR as unknown as typeof XMLHttpRequest})
  const result=req.get('/',{signal:controller.signal});if(!pre)controller.abort()
  await expect(result).rejects.toMatchObject({name:'AbortError'})
 })
})
