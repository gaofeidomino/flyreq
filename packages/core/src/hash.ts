import type { RequestConfig } from './types'

/** FNV-1a 32-bit hash → hex (stable, no crypto deps) */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function stableStringify(value: unknown): string {
  if (value == null) return ''
  if (typeof value !== 'object') return String(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}

/** Hash method + url + headers + body for idempotent keys */
export function hashRequest(config: RequestConfig): string {
  const parts: string[] = [config.method, config.url]
  const headers = config.headers ?? {}
  for (const key of Object.keys(headers).sort()) {
    parts.push(key, headers[key] ?? '')
  }
  if (config.params) parts.push(stableStringify(config.params))
  if (config.body !== undefined) parts.push(stableStringify(config.body))
  return fnv1a(parts.join('\0'))
}
