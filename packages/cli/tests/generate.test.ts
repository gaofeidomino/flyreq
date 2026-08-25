import { describe, expect, it } from 'vitest'
import { generateFromApiJson, generateResourceFile } from '../src/generate'

describe('generateFromApiJson', () => {
  it('generates per-resource files and a barrel index', () => {
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
    expect(Object.keys(files)).toEqual(['article.ts', 'index.ts'])
    expect(files['index.ts']).toContain("export * from './article'")
    expect(files['article.ts']).toContain("import { flyreq, type FlyreqCallOptions } from 'flyreq'")
    expect(files['article.ts']).toContain("flyreq.post('/api/article', data, { idempotent: true, meta: { auth: true }, ...options })")
    expect(files['article.ts']).toContain('page: number, size: number')
    expect(files['article.ts']).toContain('flyreq.get')
    expect(files['article.ts']).not.toContain('busCall')
    expect(files['article.ts']).not.toContain('getRequestor')
    expect(files['article.ts']).not.toContain('createIdempotentRequestor')
  })

  it('uses cache: true when cache=true', () => {
    const code = generateResourceFile('user', {
      getUser: {
        path: '/api/user',
        method: 'GET',
        cache: true,
      },
    })
    expect(code).toContain('cache: true')
    expect(code).toContain('flyreq.get')
  })

  it('turns path placeholders into function arguments', () => {
    const code = generateResourceFile('article', {
      getArticleById: {
        path: '/api/article/{id}',
        method: 'GET',
        cache: true,
        auth: false,
      },
    })
    expect(code).toContain('id: string')
    expect(code).toContain('flyreq.get(`/api/article/${id}`')
  })
})
