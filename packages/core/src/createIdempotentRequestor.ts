import type { EventfulRequestor, RequestConfig, Requestor } from './types'
import { createCacheRequestor } from './cache/createCacheRequestor'
import type { CacheStore } from './cache/store'
import { hashRequest } from './hash'

export interface IdempotentRequestorOptions {
  key?: (config: RequestConfig) => string
  base?: Requestor
  /** Shared store so per-call wrappers still dedupe. */
  store?: CacheStore
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
  })
}
