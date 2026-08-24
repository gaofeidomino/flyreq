import { describe, expect, it, vi, afterEach } from 'vitest'
import { isRemoteSource, loadApiJson } from '../src/platform'

describe('isRemoteSource', () => {
  it('detects http(s) platform URLs', () => {
    expect(isRemoteSource('https://api-platform.example.com/export')).toBe(true)
    expect(isRemoteSource('http://localhost:3000/api.json')).toBe(true)
    expect(isRemoteSource('./api.json')).toBe(false)
    expect(isRemoteSource('/tmp/api.json')).toBe(false)
  })
})

describe('loadApiJson', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('pulls latest interface config from 接口平台', async () => {
    const payload = {
      endpoints: {
        article: {
          publishArticle: { path: '/api/article', method: 'POST' },
        },
      },
    }
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => payload,
    })))

    const api = await loadApiJson('https://api-platform.example.com/export')
    expect(api.endpoints.article.publishArticle.path).toBe('/api/article')
    expect(fetch).toHaveBeenCalledWith('https://api-platform.example.com/export')
  })

  it('throws when platform returns an error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 502 })))
    await expect(loadApiJson('https://api-platform.example.com/export')).rejects.toThrow(/HTTP 502/)
  })
})
