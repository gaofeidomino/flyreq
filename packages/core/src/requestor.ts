import type {
  BeforeRequestHandler,
  ErrorHandler,
  EventfulRequestor,
  HttpMethod,
  HttpResponse,
  PlainResponse,
  RequestConfig,
  RequestEvent,
  RequestOptions,
  Requestor,
  ResponseBodyHandler,
} from './types'

export function createHttpResponse(plain: PlainResponse): HttpResponse {
  const data = plain.data
  return {
    status: plain.status,
    statusText: plain.statusText,
    headers: plain.headers,
    url: plain.url,
    data,
    ok: plain.status >= 200 && plain.status < 300,
    async json<T = unknown>() {
      if (typeof data === 'string') {
        return JSON.parse(data) as T
      }
      return data as T
    },
    async text() {
      if (typeof data === 'string') return data
      if (data == null) return ''
      return typeof data === 'object' ? JSON.stringify(data) : String(data)
    },
    toPlain() {
      return {
        status: plain.status,
        statusText: plain.statusText,
        headers: { ...plain.headers },
        data,
        url: plain.url,
      }
    },
  }
}

export function buildConfig(
  method: HttpMethod,
  url: string,
  body?: unknown,
  options?: RequestOptions,
): RequestConfig {
  return {
    method,
    url,
    body,
    headers: options?.headers ? { ...options.headers } : undefined,
    params: options?.params,
    timeout: options?.timeout,
    signal: options?.signal,
    meta: options?.meta,
    baseURL: options?.baseURL,
  }
}

type Middleware = (
  config: RequestConfig,
  next: () => Promise<HttpResponse>,
) => Promise<HttpResponse>

/**
 * Build a full Requestor from a single `request` function.
 * Transport implementations (axios / fetch / xhr) only implement this seam.
 */
export function defineRequestor(
  request: (config: RequestConfig) => Promise<HttpResponse>,
): Requestor {
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

export function wrapRequestor(base: Requestor, middleware: Middleware): EventfulRequestor {
  const beforeHandlers: BeforeRequestHandler[] = []
  const responseHandlers: ResponseBodyHandler[] = []
  const errorHandlers: ErrorHandler[] = []

  const request = async (config: RequestConfig): Promise<HttpResponse> => {
    let current = { ...config, headers: config.headers ? { ...config.headers } : undefined }

    for (const handler of beforeHandlers) {
      const result = await handler(current)
      if (result && typeof result === 'object' && 'status' in result && 'toPlain' in result) {
        return result as HttpResponse
      }
      if (result && typeof result === 'object' && 'url' in result && 'method' in result) {
        current = result as RequestConfig
      }
    }

    const next = () => base.request(current)

    try {
      let response = await middleware(current, next)
      for (const handler of responseHandlers) {
        const result = await handler(current, response)
        if (result) response = result
      }
      return response
    }
    catch (error) {
      for (const handler of errorHandlers) {
        await handler(current, error)
      }
      throw error
    }
  }

  const requestor = defineRequestor(request) as EventfulRequestor

  requestor.on = ((event: RequestEvent, handler: BeforeRequestHandler | ResponseBodyHandler | ErrorHandler) => {
    if (event === 'beforeRequest') {
      beforeHandlers.push(handler as BeforeRequestHandler)
      return () => {
        const i = beforeHandlers.indexOf(handler as BeforeRequestHandler)
        if (i >= 0) beforeHandlers.splice(i, 1)
      }
    }
    if (event === 'responseBody') {
      responseHandlers.push(handler as ResponseBodyHandler)
      return () => {
        const i = responseHandlers.indexOf(handler as ResponseBodyHandler)
        if (i >= 0) responseHandlers.splice(i, 1)
      }
    }
    errorHandlers.push(handler as ErrorHandler)
    return () => {
      const i = errorHandlers.indexOf(handler as ErrorHandler)
      if (i >= 0) errorHandlers.splice(i, 1)
    }
  }) as EventfulRequestor['on']

  return requestor
}

/** Wrap a plain Requestor with event hooks (pass-through middleware). */
export function createEventfulRequestor(base: Requestor): EventfulRequestor {
  return wrapRequestor(base, (_config, next) => next())
}
