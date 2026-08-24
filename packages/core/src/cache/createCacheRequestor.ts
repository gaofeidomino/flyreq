import type { EventfulRequestor, PlainResponse, RequestConfig, Requestor } from '../types'
import { createHttpResponse, wrapRequestor } from '../requestor'
import { resolveBase } from '../inject'
import { useCacheStore, type CacheStore, type CacheStoreKind } from './store'

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
  }
}

export function createCacheRequestor(cacheOptions: CacheRequestorOptions = {}): EventfulRequestor {
  const options = normalizeOptions(cacheOptions)
  const store = options.store ?? useCacheStore(options.storeKind ?? options.persist)
  const base = resolveBase(options.base)

  const requestor = wrapRequestor(base, async (_config, next) => next())

  requestor.on('beforeRequest', async (config) => {
    const key = options.key(config)
    const hasKey = await store.has(key)
    if (!hasKey) return

    let valid = true
    if (options.isValid) {
      valid = await options.isValid(key, config)
    }
    else if (options.duration != null) {
      // duration is encoded in store meta via expireAt on set; has() already checks
      valid = true
    }

    if (!valid) {
      await store.delete(key)
      return
    }

    const cached = await store.get<PlainResponse>(key)
    if (cached) {
      return createHttpResponse(cached)
    }
  })

  requestor.on('responseBody', async (config, resp) => {
    const key = options.key(config)
    const meta =
      options.isValid == null && options.duration != null
        ? { expireAt: Date.now() + options.duration }
        : undefined
    await store.set(key, resp.toPlain(), meta)
  })

  return requestor
}
