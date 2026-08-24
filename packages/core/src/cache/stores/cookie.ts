import { type CacheEntry, type CacheStore, isExpired, warnUnavailable } from '../types'
import { createMemoryStore } from './memory'

const PREFIX = 'flyreq:'
const MAX_COOKIE_CHARS = 3500

function getDocument(): Document | undefined {
  try {
    if (typeof document !== 'undefined') return document
  }
  catch {
    // ignore
  }
  return undefined
}

function cookieName(key: string): string {
  return PREFIX + encodeURIComponent(key)
}

function readCookie(doc: Document, name: string): string | undefined {
  const parts = doc.cookie.split(';')
  for (const part of parts) {
    const trimmed = part.trim()
    if (trimmed.startsWith(`${name}=`)) {
      return decodeURIComponent(trimmed.slice(name.length + 1))
    }
  }
  return undefined
}

function writeCookie(doc: Document, name: string, value: string, expireAt?: number): void {
  let cookie = `${name}=${value}; path=/`
  if (expireAt != null) {
    cookie += `; expires=${new Date(expireAt).toUTCString()}`
  }
  doc.cookie = cookie
}

function deleteCookie(doc: Document, name: string): void {
  doc.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
}

function parseEntry(raw: string | undefined): CacheEntry | undefined {
  if (!raw) return undefined
  try {
    return JSON.parse(raw) as CacheEntry
  }
  catch {
    return undefined
  }
}

/** Cookie backend. Falls back to memory when `document` is missing. */
export function createCookieStore(): CacheStore {
  const doc = getDocument()
  if (!doc) {
    warnUnavailable('Cookie')
    return createMemoryStore()
  }

  function readEntry(key: string): CacheEntry | undefined {
    const raw = readCookie(doc, cookieName(key))
    const entry = parseEntry(raw)
    if (!entry && raw) deleteCookie(doc, cookieName(key))
    return entry
  }

  return {
    async has(key) {
      const entry = readEntry(key)
      if (!entry) return false
      if (isExpired(entry.meta)) {
        deleteCookie(doc, cookieName(key))
        return false
      }
      return true
    },
    async get<T>(key: string) {
      const entry = readEntry(key)
      if (!entry) return undefined
      if (isExpired(entry.meta)) {
        deleteCookie(doc, cookieName(key))
        return undefined
      }
      return entry.value as T
    },
    async set(key, value, meta) {
      const entry: CacheEntry = { value, meta }
      const encoded = encodeURIComponent(JSON.stringify(entry))
      if (encoded.length > MAX_COOKIE_CHARS) {
        console.warn('[flyreq] cookie store value too large; skipped')
        return
      }
      writeCookie(doc, cookieName(key), encoded, meta?.expireAt)
    },
    async delete(key) {
      deleteCookie(doc, cookieName(key))
    },
    async clear() {
      const parts = doc.cookie.split(';')
      for (const part of parts) {
        const name = part.trim().split('=')[0]
        if (name.startsWith(PREFIX)) deleteCookie(doc, name)
      }
    },
  }
}
