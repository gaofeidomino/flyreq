import {
  appendParams,
  createHttpResponse,
  defineRequestor,
  joinURL,
  type HttpResponse,
  type RequestConfig,
  type Requestor,
} from '@flyreq/core'

export interface XhrRequestorOptions {
  baseURL?: string
  defaultHeaders?: Record<string, string>
  XMLHttpRequest?: typeof XMLHttpRequest
}

function parseHeaders(raw: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of raw.split(/\r?\n/)) {
    const idx = line.indexOf(':')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    if (!key) continue
    result[key] = result[key] ? `${result[key]}, ${value}` : value
  }
  return result
}

function parseData(text: string, contentType: string): unknown {
  if (!text) return null
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text)
    }
    catch {
      return text
    }
  }
  try {
    return JSON.parse(text)
  }
  catch {
    return text
  }
}

function encodeBody(
  body: unknown,
  headers: Record<string, string>,
): string | FormData | Blob | ArrayBuffer | null {
  if (body == null) return null
  if (
    typeof body === 'string'
    || (typeof Blob !== 'undefined' && body instanceof Blob)
    || (typeof FormData !== 'undefined' && body instanceof FormData)
    || (typeof ArrayBuffer !== 'undefined' && body instanceof ArrayBuffer)
  ) {
    return body as string | FormData | Blob | ArrayBuffer
  }
  if (!headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json'
  }
  return JSON.stringify(body)
}

export function createXhrRequestor(options: XhrRequestorOptions = {}): Requestor {
  const XhrCtor = options.XMLHttpRequest
    ?? (typeof XMLHttpRequest !== 'undefined' ? XMLHttpRequest : undefined)

  async function request(config: RequestConfig): Promise<HttpResponse> {
    if (!XhrCtor) {
      throw new Error('[flyreq/xhr] XMLHttpRequest is not available in this environment')
    }

    const baseURL = config.baseURL ?? options.baseURL
    let url = joinURL(baseURL, config.url)
    url = appendParams(url, config.params)

    const headers: Record<string, string> = {
      ...(options.defaultHeaders ?? {}),
      ...(config.headers ?? {}),
    }

    const body =
      config.method === 'GET' || config.method === 'HEAD'
        ? null
        : encodeBody(config.body, headers)

    return new Promise((resolve, reject) => {
      const xhr = new XhrCtor()
      xhr.open(config.method, url, true)

      for (const [key, value] of Object.entries(headers)) {
        xhr.setRequestHeader(key, value)
      }

      if (config.timeout != null && config.timeout > 0) {
        xhr.timeout = config.timeout
      }

      const onAbort = () => {
        xhr.abort()
        reject(new DOMException('The operation was aborted.', 'AbortError'))
      }

      if (config.signal) {
        if (config.signal.aborted) {
          onAbort()
          return
        }
        config.signal.addEventListener('abort', onAbort, { once: true })
      }

      xhr.onload = () => {
        config.signal?.removeEventListener('abort', onAbort)
        const headerMap = parseHeaders(xhr.getAllResponseHeaders())
        const contentType = xhr.getResponseHeader('content-type') ?? headerMap['content-type'] ?? ''
        resolve(createHttpResponse({
          status: xhr.status,
          statusText: xhr.statusText,
          headers: headerMap,
          data: parseData(xhr.responseText, contentType),
          url,
        }))
      }

      xhr.onerror = () => {
        config.signal?.removeEventListener('abort', onAbort)
        reject(new Error(`[flyreq/xhr] network error ${config.method} ${url}`))
      }

      xhr.ontimeout = () => {
        config.signal?.removeEventListener('abort', onAbort)
        reject(new Error(`[flyreq/xhr] timeout ${config.method} ${url}`))
      }

      xhr.send(body as XMLHttpRequestBodyInit | null)
    })
  }

  return defineRequestor(request)
}

/** Default XHR Requestor — inject this from the composition root (bus / flyreq). */
export const requestor = createXhrRequestor()
