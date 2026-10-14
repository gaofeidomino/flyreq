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

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason); return }
    const abort = () => { clearTimeout(timer); reject(signal?.reason) }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve() }, ms)
    signal?.addEventListener('abort', abort, { once: true })
  })
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
  if (!Number.isInteger(maxCount) || maxCount < 0) throw new RangeError('maxCount must be a nonnegative integer')
  const base = resolveBase(options.base)
  const shouldRetryResponse =
    options.shouldRetryResponse === false
      ? undefined
      : (options.shouldRetryResponse ?? ((response: HttpResponse) => isRetryableStatus(response)))

  return wrapRequestor(base, async (config, next) => {
    let lastError: unknown
    let lastResponse: HttpResponse | undefined

    for (let attempt = 0; attempt <= maxCount; attempt++) {
      config.signal?.throwIfAborted()
      if (attempt > 0) {
        const delay =
          typeof options.delay === 'function'
            ? options.delay(attempt, lastError)
            : (options.delay ?? 0)
        if (delay > 0) await sleep(delay, config.signal)
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
        if (config.signal?.aborted || (error instanceof Error && error.name === 'AbortError')) throw error
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
  const maxCount = options.maxCount ?? 4
  if (!Number.isInteger(maxCount) || maxCount < 1) throw new RangeError('maxCount must be a positive integer')
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

  return wrapRequestor(base, async (config, next) => {
    await acquire()
    try {
      config.signal?.throwIfAborted()
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

  return wrapRequestor(base, async (config, next) => {
    const run = chain.then(() => { config.signal?.throwIfAborted(); return next() })
    chain = run.then(
      () => undefined,
      () => undefined,
    )
    return run as Promise<HttpResponse>
  })
}
