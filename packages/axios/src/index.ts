import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type CreateAxiosDefaults,
} from 'axios'
import {
  createHttpResponse,
  defineRequestor,
  type HttpResponse,
  type RequestConfig,
  type Requestor,
} from '@flyreq/core'

function headersToRecord(headers: unknown): Record<string, string> {
  const result: Record<string, string> = {}
  if (!headers || typeof headers !== 'object') return result
  for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
    if (value == null) continue
    result[key] = Array.isArray(value) ? value.join(', ') : String(value)
  }
  return result
}

export function createAxiosRequestor(
  axiosConfig?: CreateAxiosDefaults | AxiosInstance,
): Requestor {
  const instance: AxiosInstance =
    axiosConfig && 'request' in axiosConfig && typeof axiosConfig.request === 'function'
      ? (axiosConfig as AxiosInstance)
      : axios.create(axiosConfig as CreateAxiosDefaults | undefined)

  async function request(config: RequestConfig): Promise<HttpResponse> {
    const axiosCfg: AxiosRequestConfig = {
      url: config.url,
      method: config.method,
      headers: config.headers,
      params: config.params,
      data: config.body,
      timeout: config.timeout,
      signal: config.signal,
      baseURL: config.baseURL,
      validateStatus: () => true,
    }

    const resp = await instance.request(axiosCfg)
    return createHttpResponse({
      status: resp.status,
      statusText: resp.statusText,
      headers: headersToRecord(resp.headers),
      data: resp.data,
      url: resp.config.url ? String(resp.config.url) : config.url,
    })
  }

  return defineRequestor(request)
}

/** Default axios Requestor — inject this from the composition root (bus / flyreq). */
export const requestor = createAxiosRequestor()
