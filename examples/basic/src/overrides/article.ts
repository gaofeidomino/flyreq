/**
 * 样板不够用时不要改 generated/，在 overrides 里包一层。
 * 生成函数最后一个参数是 options，用来叠 retry / cache。
 */
import { publishArticle, type Article } from 'flyreq'

export function publishArticleReliable(article: Article) {
  return publishArticle(article, { retry: 3 })
}
