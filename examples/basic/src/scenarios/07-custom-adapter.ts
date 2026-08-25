/**
 * 场景：自定义传输实现
 *
 * 任意 HTTP 客户端只要实现 Requestor（或用 defineRequestor 包一层 `request`），
 * 就可以注入 core，无需改 request-core。
 */
import {
  flyreq,
  createHttpResponse,
  defineRequestor,
  listBackends,
  registerAdapter,
  resetFlyreqClient,
  resetRequestor,
  setBackend,
  setupFlyreq,
  type Requestor,
} from 'flyreq'
import { heading, note } from '../mock'

/** 假装这是 ofetch / ky / 公司内部 SDK */
function createOfetchLike(): Requestor {
  return defineRequestor(async (config) => {
    console.log(`  [ofetch-like] ${config.method} ${config.url}`)
    return createHttpResponse({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: {
        code: 0,
        data: { via: 'ofetch-like', url: config.url },
        message: 'ok',
      },
      url: config.url,
    })
  })
}

export async function runCustomAdapter(): Promise<void> {
  heading('1. registerAdapter + setBackend（给未来传输留扩展点）')
  resetRequestor()
  resetFlyreqClient()
  registerAdapter('ofetch', () => createOfetchLike())
  setupFlyreq({
    backend: 'ofetch',
    baseURL: 'https://api.example.com',
  })
  note(`已注册: ${listBackends().join(', ')}`)
  const a = await flyreq.get<{ via: string }>('/api/custom')
  note(`结果: ${JSON.stringify(a)}`)

  heading('2. setBackend(requestor) 直接塞实例，不必注册名字')
  const another = createOfetchLike()
  setBackend(another)
  await flyreq.post('/api/custom', { n: 1 })
  note('之后业务代码仍然 flyreq.get / 生成函数，感知不到底下是谁')
}
