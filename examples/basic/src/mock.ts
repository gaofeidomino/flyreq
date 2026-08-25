import {
  createHttpResponse,
  defineRequestor,
  registerAdapter,
  resetFlyreqClient,
  resetRequestor,
  setupFlyreq,
  type RequestConfig,
  type Requestor,
} from 'flyreq'

export interface MockOptions {
  /** Log prefix */
  label?: string
  /** Artificial latency per request */
  delayMs?: number
  /** Throw on the first N calls (per URL+method) */
  failTimes?: number
  /** Envelope `code`; non-zero makes busCall throw BusError */
  busCode?: number
  /** HTTP status */
  status?: number
  /** Custom payload instead of the default echo object */
  data?: (config: RequestConfig, call: number) => unknown
}

export interface MockTransport {
  requestor: Requestor
  calls: RequestConfig[]
  maxActive: number
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Custom Requestor used by every scenario — no real network.
 * Built with `defineRequestor`, the same seam axios / fetch / xhr implement.
 */
export function createMockRequestor(options: MockOptions = {}): MockTransport {
  const calls: RequestConfig[] = []
  const failCount = new Map<string, number>()
  let active = 0
  let maxActive = 0
  const label = options.label ?? 'mock'

  const requestor = defineRequestor(async (config) => {
    calls.push(config)
    active++
    maxActive = Math.max(maxActive, active)
    const callKey = `${config.method}:${config.url}`
    const n = (failCount.get(callKey) ?? 0) + 1
    failCount.set(callKey, n)

    const auth = config.headers?.Authorization ? '(auth)' : '(anon)'
    console.log(`  [${label}] ${config.method} ${config.url} #${n} ${auth}`)

    try {
      if (options.delayMs) await sleep(options.delayMs)
      if (options.failTimes && n <= options.failTimes) {
        throw new Error(`[${label}] simulated failure #${n} ${callKey}`)
      }

      const payload = options.data?.(config, n) ?? {
        url: config.url,
        method: config.method,
        body: config.body,
        params: config.params,
        call: n,
      }

      return createHttpResponse({
        status: options.status ?? 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: {
          code: options.busCode ?? 0,
          data: payload,
          message: options.busCode ? 'business error' : 'ok',
        },
        url: config.url,
      })
    }
    finally {
      active--
    }
  })

  return {
    requestor,
    calls,
    get maxActive() {
      return maxActive
    },
  }
}

/** Reset DIP inject, register this mock as `backend: 'mock'`, attach bus protocol. */
export function bootMock(options: MockOptions = {}): MockTransport {
  resetRequestor()
  resetFlyreqClient()
  const mock = createMockRequestor(options)
  registerAdapter('mock', () => mock.requestor)
  setupFlyreq({
    baseURL: 'https://api.example.com',
    backend: 'mock',
    token: 'demo-token',
    ignoreConfigFile: true,
  })
  return mock
}

export function heading(title: string): void {
  console.log(`\n▸ ${title}`)
}

export function note(text: string): void {
  console.log(`    ${text}`)
}
