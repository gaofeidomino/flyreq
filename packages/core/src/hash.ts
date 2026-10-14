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

function stableStringify(value: unknown, seen = new Set<object>()): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'function' || typeof value === 'symbol') throw new TypeError('Unsupported request value; provide a custom key')
  if (typeof value !== 'object') return JSON.stringify([typeof value, String(value)])
  if (seen.has(value)) throw new TypeError('Cannot key a cyclic request body')
  seen.add(value)
  try {
    if (value instanceof Date) return JSON.stringify(['date', value.toISOString()])
    if (value instanceof URLSearchParams) return JSON.stringify(['params', value.toString()])
    if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
      const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
      return JSON.stringify(['bytes', Array.from(bytes)])
    }
    if (Array.isArray(value)) return JSON.stringify(['array', value.map(v => stableStringify(v, seen))])
    const proto = Object.getPrototypeOf(value)
    if (proto !== Object.prototype && proto !== null) {
      throw new TypeError('Unsupported request body for automatic cache key; provide a custom key')
    }
    const obj = value as Record<string, unknown>
    return JSON.stringify(['object', Object.keys(obj).sort().map(k => [k, stableStringify(obj[k], seen)])])
  }
  finally { seen.delete(value) }
}

/** Hash method + url + headers + params + body for idempotent keys */
export function hashRequest(config: RequestConfig): string {
  const parts: string[] = [config.method, config.baseURL ?? '', config.url]
  const headers = config.headers ?? {}
  for (const key of Object.keys(headers).sort()) {
    parts.push(key, headers[key] ?? '')
  }
  if (config.params) parts.push(stableStringify(config.params))
  if (config.body !== undefined) parts.push(stableStringify(config.body))

  const payload = parts.join('\0')
  return SEEDS.map((seed) => mix32(payload, seed).toString(16).padStart(8, '0')).join('')
}
