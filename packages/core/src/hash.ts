import type { RequestConfig } from './types'

const C1 = 0xcc9e2d51
const C2 = 0x1b873593

/** MurmurHash3-style 32-bit mixer over UTF-16 code units. */
function mix32(input: string, seed: number): number {
  let h = seed >>> 0
  for (let i = 0; i < input.length; i++) {
    let k = Math.imul(input.charCodeAt(i), C1)
    k = (k << 15) | (k >>> 17)
    k = Math.imul(k, C2)
    h ^= k
    h = (h << 13) | (h >>> 19)
    h = (Math.imul(h, 5) + 0xe6546b64) | 0
  }
  h ^= input.length
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

/** Four independent seeds → 128 bits, so idempotent keys don't collide. */
const SEEDS = [0x9747b28c, 0x1b873593, 0x85ebca6b, 0x27d4eb2f]

function stableStringify(value: unknown): string {
  if (value == null) return ''
  if (typeof value !== 'object') return String(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}

/** Hash method + url + headers + params + body for idempotent keys */
export function hashRequest(config: RequestConfig): string {
  const parts: string[] = [config.method, config.url]
  const headers = config.headers ?? {}
  for (const key of Object.keys(headers).sort()) {
    parts.push(key, headers[key] ?? '')
  }
  if (config.params) parts.push(stableStringify(config.params))
  if (config.body !== undefined) parts.push(stableStringify(config.body))

  const payload = parts.join('\0')
  return SEEDS.map((seed) => mix32(payload, seed).toString(16).padStart(8, '0')).join('')
}
