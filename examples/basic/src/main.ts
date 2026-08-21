/**
 * Minimal flyreq umbrella usage (mock Requestor — no network).
 *
 *   pnpm --filter @flyreq/example-basic start
 */
import {
  setup,
  setBackend,
  setToken,
  busCall,
  createCacheRequestor,
  createRetryRequestor,
  createHttpResponse,
  registerAdapter,
  getBackend,
  type RequestConfig,
  type Requestor,
} from 'flyreq'

function createEchoRequestor(): Requestor {
  async function request(config: RequestConfig) {
    console.log(`[echo] ${config.method} ${config.url}`, config.headers, config.body ?? config.params)
    return createHttpResponse({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      data: { code: 0, data: { echoed: true, url: config.url, backend: getBackend() }, message: 'ok' },
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
  registerAdapter('echo', () => createEchoRequestor())
  setup({
    baseURL: 'https://api.example.com',
    backend: 'echo',
    ignoreConfigFile: true,
  })
  setToken('demo-token')

  console.log('backend:', getBackend())

  const retry = createRetryRequestor({ maxCount: 2 })
  const data = await busCall<{ echoed: boolean, backend?: string }>(retry, 'GET', '/api/ping', undefined, {
    meta: { auth: true },
  })
  console.log('busCall result:', data)

  // Switch transport at runtime (still echo — demonstrates API)
  setBackend('echo')
  const cached = createCacheRequestor({ duration: 60_000 })
  await cached.get('/api/cached')
  await cached.get('/api/cached')
  console.log('done')
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
