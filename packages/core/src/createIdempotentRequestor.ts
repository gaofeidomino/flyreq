import type { EventfulRequestor, HttpResponse, RequestConfig, Requestor } from './types'
import { createCacheRequestor } from './cache/createCacheRequestor'
import type { CacheStore } from './cache/store'
import { hashRequest } from './hash'

/** Requests stay deduped for this long unless `duration` says otherwise. */
export const DEFAULT_IDEMPOTENT_DURATION = 5 * 60 * 1000

export interface IdempotentRequestorOptions {
  key?: (config: RequestConfig) => string
  base?: Requestor
  /** Shared store so per-call wrappers still dedupe. */
  store?: CacheStore
  /** How long a submission counts as duplicate; defaults to 5 minutes. */
  duration?: number
  shouldCache?: (config: RequestConfig, response: HttpResponse) => boolean | Promise<boolean>
  /** Shared in-flight registry, so a new wrapper per call still blocks double-submits. */
  inFlight?: Map<string, Promise<HttpResponse>>
}

export function createIdempotentRequestor(
  genKeyOrOptions?: ((config: RequestConfig) => string) | IdempotentRequestorOptions,
): EventfulRequestor {
  const options: IdempotentRequestorOptions =
    typeof genKeyOrOptions === 'function'
      ? { key: genKeyOrOptions }
      : (genKeyOrOptions ?? {})

  return createCacheRequestor({
    key: (config) => (options.key ? options.key(config) : hashRequest(config)),
    persist: false,
    base: options.base,
    store: options.store,
    duration: options.duration ?? DEFAULT_IDEMPOTENT_DURATION,
    shouldCache: options.shouldCache,
    inFlight: options.inFlight,
  })
}
