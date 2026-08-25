/**
 * 场景：请求幂等
 *
 * 重复 = 方法 + URL + 头 + 体 完全一致（hashRequest）。
 * 实现上就是 persist:false 的缓存。
 */
import { createIdempotentRequestor, hashRequest } from 'flyreq'
import { bootMock, heading, note } from '../mock'

export async function runIdempotent(): Promise<void> {
  heading('1. 相同支付单连点两次，只打一次网')
  const mock = bootMock({ label: 'pay' })
  const idem = createIdempotentRequestor()
  await idem.post('/api/pay', { orderId: 1, amount: 99 })
  await idem.post('/api/pay', { orderId: 1, amount: 99 })
  note(`同一订单 POST 两次，网络=${mock.calls.length}（应为 1）`)

  heading('2. 不同 body 视为新请求')
  await idem.post('/api/pay', { orderId: 2, amount: 99 })
  note(`换 orderId 后网络=${mock.calls.length}（应为 2）`)

  heading('3. 自定义幂等键（只按 orderId）')
  const byOrder = createIdempotentRequestor((config) => {
    const body = config.body as { orderId?: string } | undefined
    return `pay:${body?.orderId ?? hashRequest(config)}`
  })
  const before = mock.calls.length
  await byOrder.post('/api/pay', { orderId: 'A', amount: 1 })
  await byOrder.post('/api/pay', { orderId: 'A', amount: 999 })
  note(`orderId 相同但 amount 不同，自定义 key 仍去重，增量网络=${mock.calls.length - before}（应为 1）`)
}
