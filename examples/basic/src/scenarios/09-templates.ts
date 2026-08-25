/**
 * 场景：业务模板（request-bus）
 *
 * 对应接口平台字段：idempotent / cache / pager / auth。
 * 生成物类似 `flyreq gen ./api.json -o ./generated`，个性化放 overrides/。
 */
import { getArticleById, getArticles, publishArticle } from 'flyreq'
import { bootMock, heading, note } from '../mock'

export async function runTemplates(): Promise<void> {
  const mock = bootMock({
    label: 'api',
    data: (config) => {
      if (config.method === 'POST') {
        return { id: 'a1', ...(config.body as object) }
      }
      if (config.url.startsWith('/api/article/')) {
        return { id: 'a1', title: 'Cached', content: 'from cache layer' }
      }
      return {
        list: [{ id: 'a1', title: 'Hello', content: 'world' }],
        total: 1,
      }
    },
  })

  heading('1. getArticles：分页 + 公开接口（auth: false）')
  const page = await getArticles(1, 10)
  note(`list=${JSON.stringify(page.list)} total=${page.total}`)
  note(`Authorization: ${String(mock.calls.at(-1)?.headers?.Authorization)}`)

  heading('2. publishArticle：幂等 POST（连点不重复提交）')
  const article = { title: 'Hello', content: 'world' }
  await publishArticle(article)
  await publishArticle(article)
  const posts = mock.calls.filter((c) => c.method === 'POST')
  note(`同一文章 POST 两次，网络=${posts.length}（应为 1）`)

  heading('3. getArticleById：带 TTL 的缓存详情')
  await getArticleById('a1')
  await getArticleById('a1')
  const details = mock.calls.filter((c) => c.url === '/api/article/a1')
  note(`详情 GET 两次，网络=${details.length}（应为 1）`)
}
