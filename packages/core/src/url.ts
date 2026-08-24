export function joinURL(baseURL: string | undefined, url: string): string {
  if (!baseURL) return url
  if (/^https?:\/\//i.test(url)) return url
  const base = baseURL.replace(/\/+$/, '')
  const path = url.replace(/^\/+/, '')
  return `${base}/${path}`
}

export function appendParams(url: string, params?: Record<string, unknown>): string {
  if (!params || Object.keys(params).length === 0) return url
  const u = new URL(url, typeof location !== 'undefined' ? location.href : 'http://localhost')
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue
    u.searchParams.set(key, String(value))
  }
  if (!/^https?:\/\//i.test(url) && typeof location === 'undefined') {
    return `${u.pathname}${u.search}`
  }
  return u.toString()
}
