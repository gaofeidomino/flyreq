import { describe, expect, it } from 'vitest'
import { generateFromApiJson, generateResourceFile } from '../src/generate'

describe('generateFromApiJson', () => {
  it('generates per-resource files', () => {
    const files = generateFromApiJson({
      endpoints: {
        article: {
          publishArticle: {
            path: '/api/article',
            description: '发布文章',
            method: 'POST',
            auth: true,
            idempotent: true,
            cache: false,
            pager: false,
          },
          getArticles: {
            path: '/api/article',
            description: '获取文章',
            method: 'GET',
            auth: false,
            idempotent: false,
            cache: false,
            pager: true,
          },
        },
      },
    })
    expect(Object.keys(files)).toEqual(['article.ts'])
    expect(files['article.ts']).toContain('createIdempotentRequestor')
    expect(files['article.ts']).toContain('useRequestor')
    expect(files['article.ts']).toContain("busCall(req, 'POST', '/api/article'")
    expect(files['article.ts']).toContain('page: number, size: number')
  })

  it('uses cache requestor when cache=true', () => {
    const code = generateResourceFile('user', {
      getUser: {
        path: '/api/user',
        method: 'GET',
        cache: true,
      },
    })
    expect(code).toContain('createCacheRequestor')
  })
})
