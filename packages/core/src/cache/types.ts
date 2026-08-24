export interface CacheMeta {
  expireAt?: number
}

export interface CacheEntry<T = unknown> {
  value: T
  meta?: CacheMeta
}

/** Unified persistence interface — all store backends implement this seam. */
export interface CacheStore {
  has(key: string): Promise<boolean>
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, value: T, meta?: CacheMeta): Promise<void>
  delete(key: string): Promise<void>
  clear(): Promise<void>
}

export function isExpired(meta?: CacheMeta): boolean {
  return meta?.expireAt != null && Date.now() > meta.expireAt
}

export function warnUnavailable(name: string): void {
  console.warn(`[flyreq] ${name} unavailable; falling back to memory cache store`)
}
