export class BusError extends Error {
  readonly code: number | string
  readonly raw: unknown

  constructor(message: string, code: number | string, raw?: unknown) {
    super(message)
    this.name = 'BusError'
    this.code = code
    this.raw = raw
  }
}

/** Placeholder company envelope — customize in your fork */
export interface ApiEnvelope<T = unknown> {
  code: number
  data: T
  message: string
}

export function isApiEnvelope(value: unknown): value is ApiEnvelope {
  return (
    typeof value === 'object'
    && value != null
    && 'code' in value
    && 'data' in value
  )
}

export function unwrapEnvelope<T = unknown>(payload: unknown, successCode = 0): T {
  if (!isApiEnvelope(payload)) {
    return payload as T
  }
  if (payload.code !== successCode) {
    throw new BusError(payload.message || `Bus error code ${payload.code}`, payload.code, payload)
  }
  return payload.data as T
}
