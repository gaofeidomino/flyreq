import {
  createCacheRequestor,
  createIdempotentRequestor,
  createMemoryStore,
  createRetryRequestor,
  getRequestor,
  type CacheRequestorOptions,
  type HttpMethod,
  type IdempotentRequestorOptions,
  type RequestConfig,
  type RetryRequestorOptions,
} from '@flyreq/core'
import { busCall, type BusCallOptions } from './setup'

export type FlyreqRetry = boolean | number | RetryRequestorOptions
export type FlyreqCache = boolean | number | CacheRequestorOptions
export type FlyreqIdempotent =
  | boolean
  | ((config: RequestConfig) => string)
  | IdempotentRequestorOptions

export interface FlyreqCallOptions extends BusCallOptions {
  /** Retry this call. `false` opts out of the setup default. */
  retry?: FlyreqRetry
  /** Cache GET-like results. A number is TTL in ms. */
  cache?: FlyreqCache
  /** Dedupe identical in-flight / repeated submissions. */
  idempotent?: FlyreqIdempotent
}

export interface FlyreqDefaults {
  retry?: FlyreqRetry
}

let defaults: FlyreqDefaults = {}
let memoryCache = createMemoryStore()
let idempotentStore = createMemoryStore()

export function configureFlyreq(next: FlyreqDefaults): void {
  defaults = { ...next }
}

export function getFlyreqDefaults(): FlyreqDefaults {
  return { ...defaults }
}

/** Clear per-client cache / idempotent stores and call-level defaults. Does not un-inject the Requestor. */
export function resetFlyreqClient(): void {
  defaults = {}
  memoryCache = createMemoryStore()
  idempotentStore = createMemoryStore()
}

function resolveRetry(call: FlyreqRetry | undefined): RetryRequestorOptions | undefined {
  const value = call === undefined ? defaults.retry : call
  if (value === false || value == null) return undefined
  if (value === true) return { maxCount: 5 }
  if (typeof value === 'number') return { maxCount: value }
  const { base: _base, ...rest } = value
  return rest
}

function resolveCache(cache: FlyreqCache | undefined): CacheRequestorOptions | undefined {
  if (cache === false || cache == null) return undefined
  if (cache === true) return { store: memoryCache }
  if (typeof cache === 'number') return { duration: cache, store: memoryCache }
  const { base: _base, ...rest } = cache
  return {
    ...rest,
    store: rest.store ?? (rest.persist ? undefined : memoryCache),
  }
}

function resolveIdempotent(value: FlyreqIdempotent | undefined): IdempotentRequestorOptions | undefined {
  if (!value) return undefined
  if (value === true) return { store: idempotentStore }
  if (typeof value === 'function') return { key: value, store: idempotentStore }
  const { base: _base, ...rest } = value
  return { ...rest, store: rest.store ?? idempotentStore }
}

async function call<T>(
  method: HttpMethod,
  url: string,
  body?: unknown,
  options?: FlyreqCallOptions,
): Promise<T> {
  const { retry, cache, idempotent, ...busOptions } = options ?? {}
  let req = getRequestor()

  const retryOpts = resolveRetry(retry)
  if (retryOpts) req = createRetryRequestor({ ...retryOpts, base: req })

  const idempotentOpts = resolveIdempotent(idempotent)
  if (idempotentOpts) req = createIdempotentRequestor({ ...idempotentOpts, base: req })

  const cacheOpts = resolveCache(cache)
  if (cacheOpts) req = createCacheRequestor({ ...cacheOpts, base: req })

  return busCall<T>(req, method, url, body, busOptions)
}

export const flyreq = {
  get<T = unknown>(url: string, options?: FlyreqCallOptions): Promise<T> {
    return call<T>('GET', url, undefined, options)
  },
  post<T = unknown>(url: string, body?: unknown, options?: FlyreqCallOptions): Promise<T> {
    return call<T>('POST', url, body, options)
  },
  put<T = unknown>(url: string, body?: unknown, options?: FlyreqCallOptions): Promise<T> {
    return call<T>('PUT', url, body, options)
  },
  patch<T = unknown>(url: string, body?: unknown, options?: FlyreqCallOptions): Promise<T> {
    return call<T>('PATCH', url, body, options)
  },
  delete<T = unknown>(url: string, options?: FlyreqCallOptions): Promise<T> {
    return call<T>('DELETE', url, undefined, options)
  },
  request<T = unknown>(method: HttpMethod, url: string, body?: unknown, options?: FlyreqCallOptions): Promise<T> {
    return call<T>(method, url, body, options)
  },
}
