/**
 * 样板不够用时不要改 generated/，在 overrides 里包一层。
 *
 *   pnpm --filter @flyreq/example-basic start -- templates
 */
import { busCall, createRetryRequestor, type Article } from 'flyreq'

export const publishArticleReliable = (() => {
  const req = createRetryRequestor(3)
  return async (article: Article) => {
    return busCall<Article>(req, 'POST', '/api/article', article, {
      meta: { auth: true },
    })
  }
})()
