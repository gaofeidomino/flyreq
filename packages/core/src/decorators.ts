import type { EventfulRequestor, HttpResponse, RequestConfig, Requestor } from './types'
import { wrapRequestor } from './requestor'
import { resolveBase } from './inject'

export interface RetryRequestorOptions {
  maxCount?: number
  /** Delay between retries in ms (fixed or per-attempt) */
  delay?: number | ((attempt: number, error: unknown) => number)
  shouldRetry?: (error: unknown, attempt: number, config: RequestConfig) => boolean | Promise<boolean>
  base?: Requestor
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function createRetryRequestor(options: RetryRequestorOptions = {}): EventfulRequestor {
  const maxCount = options.maxCount ?? 5
  const base = resolveBase(options.base)

  return wrapRequestor(base, async (config, next) => {
    let lastError: unknown
    for (let attempt = 0; attempt <= maxCount; attempt++) {
      try {
        return await next()
      }
      catch (error) {
        lastError = error
        if (attempt >= maxCount) break
        const should =
          options.shouldRetry
            ? await options.shouldRetry(error, attempt + 1, config)
            : true
        if (!should) break
        const delay =
          typeof options.delay === 'function'
            ? options.delay(attempt + 1, error)
            : (options.delay ?? 0)
        if (delay > 0) await sleep(delay)
      }
    }
    throw lastError
  })
}

export interface ParallelRequestorOptions {
  maxCount?: number
  base?: Requestor
}

export function createParallelRequestor(options: ParallelRequestorOptions = {}): EventfulRequestor {
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
