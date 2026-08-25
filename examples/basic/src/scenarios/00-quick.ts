/**
 * 日常用法：setup 一次，之后 flyreq.get / post。
 * 生成的业务函数（flyreq gen）也是包这一层。
 */
import {
  flyreq,
  registerAdapter,
  resetFlyreqClient,
  resetRequestor,
  setupFlyreq,
} from 'flyreq'
import { createMockRequestor, heading, note } from '../mock'

export async function runQuick(): Promise<void> {
  resetRequestor()
  resetFlyreqClient()
  const mock = createMockRequestor({ label: 'quick' })
  registerAdapter('mock', () => mock.requestor)

  heading('setup 一次：baseURL + token（可换成 token: () => store.token）')
  setupFlyreq({
    baseURL: 'https://api.example.com',
    backend: 'mock',
    token: 'demo-token',
  })

  heading('之后只调 flyreq.get / post，不必再传 Requestor')
  const me = await flyreq.get<{ url: string }>('/api/user/me')
  note(`GET /api/user/me → ${JSON.stringify(me)}`)
  note(`Authorization: ${mock.calls.at(-1)?.headers?.Authorization}`)

  await flyreq.post('/api/article', { title: 'Hello' }, { idempotent: true })
  await flyreq.post('/api/article', { title: 'Hello' }, { idempotent: true })
  const posts = mock.calls.filter(c => c.method === 'POST')
  note(`同一文章 POST 两次（idempotent），网络=${posts.length}（应为 1）`)

  await flyreq.get('/api/profile', { cache: 60_000 })
  await flyreq.get('/api/profile', { cache: 60_000 })
  const profiles = mock.calls.filter(c => c.url === '/api/profile')
  note(`profile GET 两次（cache: 60s），网络=${profiles.length}（应为 1）`)
}
