import type { EventfulRequestor, HttpResponse, PlainResponse, RequestConfig, Requestor } from '../types'
import { createHttpResponse, wrapRequestor } from '../requestor'
import { resolveBase } from '../inject'
import { resolveCacheStore, type CacheStore, type CacheStoreKind } from './store'

export interface CacheRequestorOptions {
  key?: (config: RequestConfig) => string
  persist?: boolean
  /** TTL in milliseconds; ignored when `isValid` is provided */
  duration?: number
  isValid?: (key: string, config: RequestConfig) => boolean | Promise<boolean>
  /** Inject a CacheStore (DIP); takes precedence over persist / storeKind */
  store?: CacheStore
  storeKind?: CacheStoreKind
  base?: Requestor
  /**
   * Decide whether a response may be cached. Defaults to `response.ok`, so
   * failures are never served from cache. Return false to skip storing.
   */
  shouldCache?: (config: RequestConfig, response: HttpResponse) => boolean | Promise<boolean>
  /**
   * Share one in-flight request between concurrent callers with the same key.
   * This is what stops double-submits; disable only for load testing.
   */
  dedupeInFlight?: boolean
  /**
   * Registry of in-flight requests. Pass a shared map when callers build a new
   * requestor per call, otherwise each instance dedupes only against itself.
   */
  inFlight?: Map<string, Promise<HttpResponse>>
}

function defaultKey(config: RequestConfig): string {
  const params = config.params ? JSON.stringify(config.params) : ''
  return `${config.method}:${config.url}:${params}`
}

function normalizeOptions(options: CacheRequestorOptions = {}) {
  return {
    key: options.key ?? defaultKey,
    persist: options.persist ?? false,
    duration: options.duration,
    isValid: options.isValid,
    store: options.store,
    storeKind: options.storeKind,
    base: options.base,
    shouldCache: options.shouldCache ?? ((_config, response) => response.ok),
    dedupeInFlight: options.dedupeInFlight ?? true,
    inFlight: options.inFlight,
  }
}

export function createCacheRequestor(cacheOptions: CacheRequestorOptions = {}): EventfulRequestor {
  const options = normalizeOptions(cacheOptions)
  const store = options.store ?? resolveCacheStore(options.storeKind ?? options.persist)
  const base = resolveBase(options.base)
  const inFlight = options.inFlight ?? new Map<string, Promise<HttpResponse>>()

  const requestor = wrapRequestor(base, async (config, next) => {
    if (!options.dedupeInFlight) return next()

    const key = options.key(config)
    const pending = inFlight.get(key)
    if (pending) return pending

    const promise = next()
    inFlight.set(key, promise)
    try {
      return await promise
    }
    finally {
      inFlight.delete(key)
    }
  })

  requestor.on('beforeRequest', async (config) => {
    const key = options.key(config)
    if (!(await store.has(key))) return

    if (options.isValid && !(await options.isValid(key, config))) {
      await store.delete(key)
      return
    }

    const cached = await store.get<PlainResponse>(key)
    if (cached) {
      return createHttpResponse(cached)
    }
  })

  requestor.on('responseBody', async (config, resp) => {
    if (!(await options.shouldCache(config, resp))) return
    const key = options.key(config)
    const meta =
      options.isValid == null && options.duration != null
        ? { expireAt: Date.now() + options.duration }
        : undefined
    await store.set(key, resp.toPlain(), meta)
  })

  return requestor
}
