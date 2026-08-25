import type { EventfulRequestor, HttpResponse, RequestConfig, Requestor } from './types'
import { wrapRequestor } from './requestor'
import { resolveBase } from './inject'

export interface RetryRequestorOptions {
  maxCount?: number
  /** Delay between retries in ms (fixed or per-attempt) */
  delay?: number | ((attempt: number, error: unknown) => number)
  shouldRetry?: (error: unknown, attempt: number, config: RequestConfig) => boolean | Promise<boolean>
  /**
   * Retry responses the transport resolved rather than threw.
   * Defaults to 5xx and 429, since axios / fetch do not reject on those.
   */
  shouldRetryResponse?:
    | false
    | ((response: HttpResponse, attempt: number, config: RequestConfig) => boolean | Promise<boolean>)
  base?: Requestor
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryableStatus(response: HttpResponse): boolean {
  return response.status >= 500 || response.status === 429
}

export function createRetryRequestor(maxCount?: number): EventfulRequestor
export function createRetryRequestor(options?: RetryRequestorOptions): EventfulRequestor
export function createRetryRequestor(
  maxCountOrOptions: number | RetryRequestorOptions = {},
): EventfulRequestor {
  const options: RetryRequestorOptions =
    typeof maxCountOrOptions === 'number'
      ? { maxCount: maxCountOrOptions }
      : maxCountOrOptions
  const maxCount = options.maxCount ?? 5
  const base = resolveBase(options.base)
  const shouldRetryResponse =
    options.shouldRetryResponse === false
      ? undefined
      : (options.shouldRetryResponse ?? ((response: HttpResponse) => isRetryableStatus(response)))

  return wrapRequestor(base, async (config, next) => {
    let lastError: unknown
    let lastResponse: HttpResponse | undefined

    for (let attempt = 0; attempt <= maxCount; attempt++) {
      if (attempt > 0) {
        const delay =
          typeof options.delay === 'function'
            ? options.delay(attempt, lastError)
            : (options.delay ?? 0)
        if (delay > 0) await sleep(delay)
      }

      try {
        const response = await next()
        if (
          attempt < maxCount
          && shouldRetryResponse
          && (await shouldRetryResponse(response, attempt + 1, config))
        ) {
          lastResponse = response
          lastError = undefined
          continue
        }
        return response
      }
      catch (error) {
        lastError = error
        lastResponse = undefined
        if (attempt >= maxCount) break
        const should =
          options.shouldRetry
            ? await options.shouldRetry(error, attempt + 1, config)
            : true
        if (!should) break
      }
    }

    if (lastResponse) return lastResponse
    throw lastError
  })
}

export interface ParallelRequestorOptions {
  maxCount?: number
  base?: Requestor
}

export function createParallelRequestor(maxCount?: number): EventfulRequestor
export function createParallelRequestor(options?: ParallelRequestorOptions): EventfulRequestor
export function createParallelRequestor(
  maxCountOrOptions: number | ParallelRequestorOptions = {},
): EventfulRequestor {
  const options: ParallelRequestorOptions =
    typeof maxCountOrOptions === 'number'
      ? { maxCount: maxCountOrOptions }
      : maxCountOrOptions
  const maxCount = Math.max(1, options.maxCount ?? 4)
  const base = resolveBase(options.base)
  let active = 0
  const queue: Array<() => void> = []

  function acquire(): Promise<void> {
    if (active < maxCount) {
      active++
      return Promise.resolve()
    }
    return new Promise((resolve) => {
      queue.push(() => {
        active++
        resolve()
      })
    })
  }

  function release(): void {
    active--
    const next = queue.shift()
    if (next) next()
  }

  return wrapRequestor(base, async (_config, next) => {
    await acquire()
    try {
      return await next()
    }
    finally {
      release()
    }
  })
}

export interface SerialRequestorOptions {
  base?: Requestor
}

export function createSerialRequestor(options: SerialRequestorOptions = {}): EventfulRequestor {
  const base = resolveBase(options.base)
  let chain: Promise<unknown> = Promise.resolve()

  return wrapRequestor(base, async (_config, next) => {
    const run = chain.then(() => next())
    chain = run.then(
      () => undefined,
      () => undefined,
    )
    return run as Promise<HttpResponse>
  })
}
