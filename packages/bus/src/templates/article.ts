import { flyreq, type FlyreqCallOptions } from '../client'

export interface Article {
  title: string
  content: string
  id?: string
}

/** Publish article (idempotent) */
export function publishArticle(article: Article, options?: FlyreqCallOptions) {
  return flyreq.post<Article>('/api/article', article, {
    idempotent: true,
    meta: { auth: true },
    ...options,
  })
}

/** Get articles with pager */
export function getArticles(page: number, size: number, options?: FlyreqCallOptions) {
  return flyreq.get<{ list: Article[], total: number }>('/api/article', {
    params: { page, size },
    meta: { auth: false },
    ...options,
  })
}

/** Cached article detail */
export function getArticleById(id: string, options?: FlyreqCallOptions) {
  return flyreq.get<Article>(`/api/article/${id}`, {
    cache: 60_000,
    meta: { auth: false },
    ...options,
  })
}
