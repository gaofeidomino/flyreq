import {
  createCacheRequestor,
  createIdempotentRequestor,
  useRequestor,
} from '@flyreq/core'
import { busCall } from '../setup'

export interface Article {
  title: string
  content: string
  id?: string
}

/**
 * Publish article (idempotent) — hand-written template sample
 */
export const publishArticle = (() => {
  return async (article: Article) => {
    const req = createIdempotentRequestor()
    return busCall<Article>(req, 'POST', '/api/article', article, {
      meta: { auth: true },
    })
  }
})()

/**
 * Get articles with pager
 */
export const getArticles = (() => {
  return async (page: number, size: number) => {
    const req = useRequestor()
    return busCall<{ list: Article[], total: number }>(req, 'GET', '/api/article', undefined, {
      params: { page, size },
      meta: { auth: false },
    })
  }
})()

/**
 * Cached article detail example
 */
export const getArticleById = (() => {
  return async (id: string) => {
    const req = createCacheRequestor({
      duration: 60_000,
      key: (c) => `article:${c.url}:${JSON.stringify(c.params ?? {})}`,
    })
    return busCall<Article>(req, 'GET', `/api/article/${id}`, undefined, {
      meta: { auth: false },
    })
  }
})()
