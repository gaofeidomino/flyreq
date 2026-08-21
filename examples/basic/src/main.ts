/**
 * Minimal FeiFly / flyreq usage example (mock Requestor — no network).
 *
 * Run from repo root after build:
 *   pnpm --filter @flyreq/example-basic start
 */
import {
  createCacheRequestor,
  createHttpResponse,
  createRetryRequestor,
  inject,
  type RequestConfig,
  type Requestor,
} from '@flyreq/core'
import { configureBus, setToken, busCall, getToken } from '@flyreq/bus'

function createEchoRequestor(): Requestor {
  async function request(config: RequestConfig) {
    const token = getToken()
    const headers = { ...(config.headers ?? {}) }
    if (token && config.meta?.auth !== false && !headers.Authorization) {
      headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`
    }
    console.log(`[echo] ${config.method} ${config.url}`, headers, config.body ?? config.params)
    return createHttpResponse({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      data: { code: 0, data: { echoed: true, url: config.url }, message: 'ok' },
      url: config.url,
    })
  }
  return {
    request,
    get(url, options) {
      return request({ method: 'GET', url, ...options })
    },
    post(url, data, options) {
      return request({ method: 'POST', url, body: data, ...options })
    },
    put(url, data, options) {
      return request({ method: 'PUT', url, body: data, ...options })
    },
    patch(url, data, options) {
      return request({ method: 'PATCH', url, body: data, ...options })
    },
    delete(url, options) {
      return request({ method: 'DELETE', url, ...options })
    },
  }
}

async function main() {
  configureBus({ baseURL: 'https://api.example.com', successCode: 0 })
  inject(createEchoRequestor())
  setToken('demo-token')

  const retry = createRetryRequestor({ maxCount: 2 })
  const cached = createCacheRequestor({ duration: 60_000 })

  const data = await busCall<{ echoed: boolean }>(retry, 'GET', '/api/ping', undefined, {
    meta: { auth: true },
  })
  console.log('busCall result:', data)

  await cached.get('/api/cached')
  await cached.get('/api/cached') // second hit from memory cache (no second echo log)
  console.log('done')
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
