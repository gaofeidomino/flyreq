export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

export interface RequestOptions {
  headers?: Record<string, string>
  params?: Record<string, unknown>
  timeout?: number
  signal?: AbortSignal
  /** Extra fields for cache keys / bus protocol */
  meta?: Record<string, unknown>
  baseURL?: string
}

export interface RequestConfig extends RequestOptions {
  url: string
  method: HttpMethod
  body?: unknown
}

export interface PlainResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  data: unknown
  url: string
}

export interface HttpResponse {
  readonly status: number
  readonly statusText: string
  readonly headers: Record<string, string>
  readonly url: string
  readonly ok: boolean
  json<T = unknown>(): Promise<T>
  text(): Promise<string>
  toPlain(): PlainResponse
  /** Raw payload (already parsed when from axios/json) */
  readonly data: unknown
}

export interface Requestor {
  request(config: RequestConfig): Promise<HttpResponse>
  get(url: string, options?: RequestOptions): Promise<HttpResponse>
  post(url: string, data?: unknown, options?: RequestOptions): Promise<HttpResponse>
  put(url: string, data?: unknown, options?: RequestOptions): Promise<HttpResponse>
  patch(url: string, data?: unknown, options?: RequestOptions): Promise<HttpResponse>
  delete(url: string, options?: RequestOptions): Promise<HttpResponse>
}

export type RequestEvent = 'beforeRequest' | 'responseBody' | 'error'

export type BeforeRequestHandler = (
  config: RequestConfig,
) => void | RequestConfig | Promise<void | RequestConfig | HttpResponse>

export type ResponseBodyHandler = (
  config: RequestConfig,
  response: HttpResponse,
) => void | HttpResponse | Promise<void | HttpResponse>

export type ErrorHandler = (
  config: RequestConfig,
  error: unknown,
) => void | Promise<void>

export interface EventfulRequestor extends Requestor {
  on(event: 'beforeRequest', handler: BeforeRequestHandler): () => void
  on(event: 'responseBody', handler: ResponseBodyHandler): () => void
  on(event: 'error', handler: ErrorHandler): () => void
  on(event: RequestEvent, handler: BeforeRequestHandler | ResponseBodyHandler | ErrorHandler): () => void
}
