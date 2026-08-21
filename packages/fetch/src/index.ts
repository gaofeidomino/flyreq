import {
  buildConfig,
  createHttpResponse,
  type HttpResponse,
  type RequestConfig,
  type RequestOptions,
  type Requestor,
} from '@flyreq/core'

export interface FetchRequestorOptions {
  baseURL?: string
  defaultHeaders?: Record<string, string>
  fetch?: typeof globalThis.fetch
}

function joinURL(baseURL: string | undefined, url: string): string {
  if (!baseURL) return url
  if (/^https?:\/\//i.test(url)) return url
  const base = baseURL.replace(/\/+$/, '')
  const path = url.replace(/^\/+/, '')
  return `${base}/${path}`
}

function appendParams(url: string, params?: Record<string, unknown>): string {
  if (!params || Object.keys(params).length === 0) return url
  const u = new URL(url, typeof location !== 'undefined' ? location.href : 'http://localhost')
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue
    u.searchParams.set(key, String(value))
  }
  // Preserve relative URLs when no absolute base was intended
  if (!/^https?:\/\//i.test(url) && typeof location === 'undefined') {
    return `${u.pathname}${u.search}`
  }
  return u.toString()
}

function headersToRecord(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {}
  headers.forEach((value, key) => {
    result[key] = value
  })
  return result
}

async function parseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return response.json()
  }
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  }
  catch {
    return text
  }
}

export function createFetchRequestor(options: FetchRequestorOptions = {}): Requestor {
  const fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis)

  async function request(config: RequestConfig): Promise<HttpResponse> {
    const baseURL = config.baseURL ?? options.baseURL
    let url = joinURL(baseURL, config.url)
    url = appendParams(url, config.params)

    const headers: Record<string, string> = {
      ...(options.defaultHeaders ?? {}),
      ...(config.headers ?? {}),
    }

    let body: BodyInit | undefined
    if (config.body !== undefined && config.method !== 'GET' && config.method !== 'HEAD') {
      if (
        typeof config.body === 'string'
        || config.body instanceof Blob
        || config.body instanceof FormData
        || config.body instanceof URLSearchParams
        || config.body instanceof ArrayBuffer
      ) {
        body = config.body as BodyInit
      }
      else {
        if (!headers['Content-Type'] && !headers['content-type']) {
          headers['Content-Type'] = 'application/json'
        }
        body = JSON.stringify(config.body)
      }
    }

    const init: RequestInit = {
      method: config.method,
      headers,
      body,
      signal: config.signal,
    }

    let timer: ReturnType<typeof setTimeout> | undefined
    if (config.timeout != null && config.timeout > 0 && !config.signal) {
      const controller = new AbortController()
      init.signal = controller.signal
      timer = setTimeout(() => controller.abort(), config.timeout)
    }

    try {
      const resp = await fetchImpl(url, init)
      const data = await parseBody(resp)
      return createHttpResponse({
        status: resp.status,
        statusText: resp.statusText,
        headers: headersToRecord(resp.headers),
        data,
        url: resp.url || url,
      })
    }
    finally {
      if (timer) clearTimeout(timer)
    }
  }

  return {
    request,
    get(url: string, opts?: RequestOptions) {
      return request(buildConfig('GET', url, undefined, opts))
    },
    post(url: string, data?: unknown, opts?: RequestOptions) {
      return request(buildConfig('POST', url, data, opts))
    },
    put(url: string, data?: unknown, opts?: RequestOptions) {
      return request(buildConfig('PUT', url, data, opts))
    },
    patch(url: string, data?: unknown, opts?: RequestOptions) {
      return request(buildConfig('PATCH', url, data, opts))
    },
    delete(url: string, opts?: RequestOptions) {
      return request(buildConfig('DELETE', url, undefined, opts))
    },
  }
}

export const requestor = createFetchRequestor()
