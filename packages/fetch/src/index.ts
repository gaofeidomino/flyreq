import {
  appendParams,
  createHttpResponse,
  defineRequestor,
  joinURL,
  type HttpResponse,
  type RequestConfig,
  type Requestor,
} from '@flyreq/core'

export interface FetchRequestorOptions {
  baseURL?: string
  defaultHeaders?: Record<string, string>
  fetch?: typeof globalThis.fetch
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

  return defineRequestor(request)
}

/** Default fetch Requestor — inject this from the composition root (bus / flyreq). */
export const requestor = createFetchRequestor()
