import {
  createCacheRequestor,
  createIdempotentRequestor,
  createMemoryStore,
  createRetryRequestor,
  getRequestor,
  type CacheRequestorOptions,
  type HttpMethod,
  type HttpResponse,
  type IdempotentRequestorOptions,
  type RequestConfig,
  type RetryRequestorOptions,
} from '@flyreq/core'
import { isApiEnvelope } from './protocol'
import { busCall, getBusConfig, type BusCallOptions } from './setup'

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
// Each call builds its own wrapper, so dedupe state has to live out here.
let cacheInFlight = new Map<string, Promise<HttpResponse>>()
let idempotentInFlight = new Map<string, Promise<HttpResponse>>()

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
  cacheInFlight = new Map()
  idempotentInFlight = new Map()
}

function parsePayload(data: unknown): unknown {
  if (typeof data !== 'string') return data
  try {
    return JSON.parse(data)
  }
  catch {
    return data
  }
}

/**
 * Never cache a failure: a business error arrives as HTTP 200 with a non-success
 * `code`, so checking `response.ok` alone would pin users to a stale error.
 */
function isCacheableBusResponse(_config: RequestConfig, response: HttpResponse): boolean {
  if (!response.ok) return false
  const payload = parsePayload(response.data)
  if (!isApiEnvelope(payload)) return true
  return payload.code === (getBusConfig().successCode ?? 0)
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
  const shared = { shouldCache: isCacheableBusResponse, inFlight: cacheInFlight }
  if (cache === true) return { ...shared, store: memoryCache }
  if (typeof cache === 'number') return { ...shared, duration: cache, store: memoryCache }
  const { base: _base, ...rest } = cache
  return {
    ...shared,
    ...rest,
    store: rest.store ?? (rest.persist ? undefined : memoryCache),
    shouldCache: rest.shouldCache ?? isCacheableBusResponse,
    inFlight: rest.inFlight ?? cacheInFlight,
  }
}

function resolveIdempotent(value: FlyreqIdempotent | undefined): IdempotentRequestorOptions | undefined {
  if (!value) return undefined
  const shared = {
    store: idempotentStore,
    shouldCache: isCacheableBusResponse,
    inFlight: idempotentInFlight,
  }
  if (value === true) return shared
  if (typeof value === 'function') return { ...shared, key: value }
  const { base: _base, ...rest } = value
  return {
    ...shared,
    ...rest,
    store: rest.store ?? idempotentStore,
    shouldCache: rest.shouldCache ?? isCacheableBusResponse,
    inFlight: rest.inFlight ?? idempotentInFlight,
  }
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
  head<T = unknown>(url: string, options?: FlyreqCallOptions): Promise<T> {
    return call<T>('HEAD', url, undefined, options)
  },
  options<T = unknown>(url: string, options?: FlyreqCallOptions): Promise<T> {
    return call<T>('OPTIONS', url, undefined, options)
  },
  request<T = unknown>(method: HttpMethod, url: string, body?: unknown, options?: FlyreqCallOptions): Promise<T> {
    return call<T>(method, url, body, options)
  },
}
