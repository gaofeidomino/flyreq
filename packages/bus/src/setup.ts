import {
  buildConfig,
  inject,
  type HttpMethod,
  type RequestConfig,
  type RequestOptions,
  type Requestor,
} from '@flyreq/core'
import { createAxiosRequestor } from '@flyreq/axios'
import { createFetchRequestor } from '@flyreq/fetch'
import { BusError, unwrapEnvelope, type ApiEnvelope } from './protocol'

export interface BusConfig {
  baseURL?: string
  successCode?: number
  getToken?: () => string | undefined | null
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

export function setToken(value: string | undefined): void {
  token = value
}

export function getToken(): string | undefined {
  return busConfig.getToken?.() ?? token
}

export function getBusConfig(): BusConfig {
  return { ...busConfig }
}

function applyBusDefaults(config: RequestConfig): RequestConfig {
  const headers = { ...(config.headers ?? {}) }
  const authHeader = busConfig.authHeader ?? 'Authorization'
  const t = getToken()
  // meta.auth === false skips token; otherwise attach when token present
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

function wrapWithBus(base: Requestor): Requestor {
  async function request(config: RequestConfig) {
    return base.request(applyBusDefaults(config))
  }
  return {
    request,
    get(url, options) {
      return request(buildConfig('GET', url, undefined, options))
    },
    post(url, data, options) {
      return request(buildConfig('POST', url, data, options))
    },
    put(url, data, options) {
      return request(buildConfig('PUT', url, data, options))
    },
    patch(url, data, options) {
      return request(buildConfig('PATCH', url, data, options))
    },
    delete(url, options) {
      return request(buildConfig('DELETE', url, undefined, options))
    },
  }
}

export function useAxiosBackend(axiosConfig?: Parameters<typeof createAxiosRequestor>[0]): Requestor {
  const base =
    axiosConfig != null
      ? createAxiosRequestor(axiosConfig)
      : createAxiosRequestor(busConfig.baseURL ? { baseURL: busConfig.baseURL } : undefined)
  const wrapped = wrapWithBus(base)
  inject(wrapped)
  return wrapped
}

export function useFetchBackend(options?: Parameters<typeof createFetchRequestor>[0]): Requestor {
  const base = createFetchRequestor({
    baseURL: busConfig.baseURL,
    ...options,
  })
  const wrapped = wrapWithBus(base)
  inject(wrapped)
  return wrapped
}

/** Default: inject axios backend */
export function setupBus(config?: BusConfig): Requestor {
  if (config) configureBus(config)
  return useAxiosBackend()
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

// Auto-setup on import so `import '@flyreq/bus'` injects default axios requestor
setupBus()
