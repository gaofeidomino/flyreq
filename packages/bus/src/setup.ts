import {
  buildConfig,
  defineRequestor,
  injectRequestor,
  type HttpMethod,
  type RequestConfig,
  type RequestOptions,
  type Requestor,
} from '@flyreq/core'
import { BusError, unwrapEnvelope, type ApiEnvelope } from './protocol'

export interface BusConfig {
  baseURL?: string
  successCode?: number
  getRequestToken?: () => string | undefined | null
  /** Header name for token; default Authorization */
  authHeader?: string
}

let busConfig: BusConfig = {
  successCode: 0,
  authHeader: 'Authorization',
}

let token: string | undefined

export function configureBus(config: BusConfig): void {
  busConfig = { ...busConfig, ...config }
}

export function setRequestToken(value: string | undefined): void {
  token = value
}

export function getRequestToken(): string | undefined {
  return busConfig.getRequestToken?.() ?? token
}

export function getBusConfig(): BusConfig {
  return { ...busConfig }
}

function applyBusDefaults(config: RequestConfig): RequestConfig {
  const headers = { ...(config.headers ?? {}) }
  const authHeader = busConfig.authHeader ?? 'Authorization'
  const t = getRequestToken()
  const skipAuth = config.meta?.auth === false
  if (t && !skipAuth && !headers[authHeader]) {
    headers[authHeader] = t.startsWith('Bearer ') ? t : `Bearer ${t}`
  }
  return {
    ...config,
    headers,
    baseURL: config.baseURL ?? busConfig.baseURL,
  }
}

/** Wrap any Requestor with bus defaults (token / baseURL). Does not inject. */
export function attachBus(base: Requestor): Requestor {
  return defineRequestor(async (config) => base.request(applyBusDefaults(config)))
}

/**
 * DIP composition root: inject a concrete Requestor into core and attach bus protocol.
 * `request-core` only depends on the Requestor interface; pass axios / fetch / xhr here.
 *
 * ```ts
 * import { bootstrapRequestor } from '@flyreq/bus'
 * import { requestor } from '@flyreq/axios'
 * bootstrapRequestor(requestor)
 * ```
 */
export function bootstrapRequestor(requestor: Requestor, config?: BusConfig): Requestor {
  if (config) configureBus(config)
  return injectBus(requestor)
}

/** Attach bus defaults and inject as the global Requestor */
export function injectBus(base: Requestor): Requestor {
  const wrapped = attachBus(base)
  injectRequestor(wrapped)
  return wrapped
}

export interface BusCallOptions extends RequestOptions {
  /** Skip envelope unwrap and return raw json */
  raw?: boolean
}

/**
 * Perform a request and unwrap `{ code, data, message }` envelope.
 */
export async function busCall<T = unknown>(
  requestor: Requestor,
  method: HttpMethod,
  url: string,
  body?: unknown,
  options?: BusCallOptions,
): Promise<T> {
  const { raw, ...reqOptions } = options ?? {}
  const config = buildConfig(method, url, body, reqOptions)
  const response = await requestor.request(config)
  if (!response.ok) {
    throw new BusError(`HTTP ${response.status}`, response.status, response.toPlain())
  }
  const json = await response.json<ApiEnvelope<T> | T>()
  if (raw) return json as T
  return unwrapEnvelope<T>(json, busConfig.successCode ?? 0)
}

/** @deprecated use busCall */
export async function busRequest<T = unknown>(
  requestor: Requestor,
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  url: string,
  dataOrOptions?: unknown,
  options?: BusCallOptions,
): Promise<T> {
  const m = method.toUpperCase() as HttpMethod
  if (m === 'GET' || m === 'DELETE') {
    return busCall<T>(requestor, m, url, undefined, dataOrOptions as BusCallOptions)
  }
  return busCall<T>(requestor, m, url, dataOrOptions, options)
}
