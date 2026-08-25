/**
 * 场景：request-bus 协议 —— token、跳过鉴权、信封解包、业务错误
 */
import { BusError, flyreq, setRequestToken } from 'flyreq'
import { bootMock, heading, note } from '../mock'

export async function runBusProtocol(): Promise<void> {
  heading('1. setup 传入 token 后，请求自动带 Authorization')
  const authed = bootMock({ label: 'auth' })
  await flyreq.get('/api/user/me')
  note(`Authorization: ${authed.calls.at(-1)?.headers?.Authorization}`)

  heading('2. meta.auth = false 跳过鉴权（公开接口）')
  await flyreq.get('/api/article', {
    meta: { auth: false },
    params: { page: 1, size: 10 },
  })
  note(`公开接口 Authorization: ${String(authed.calls.at(-1)?.headers?.Authorization)}`)

  heading('3. 信封 { code, data, message }：成功时直接返回 data')
  const data = await flyreq.get<{ url: string }>('/api/ok')
  note(`解包结果: ${JSON.stringify(data)}`)

  heading('4. code !== 0 时抛 BusError')
  bootMock({ busCode: 10001, label: 'biz-err' })
  try {
    await flyreq.post('/api/pay', { orderId: 1 })
  }
  catch (err) {
    const e = err as BusError
    note(`捕获 ${e.name} code=${e.code} message=${e.message}`)
  }

  heading('5. 运行时换 token')
  const rotated = bootMock({ label: 'token' })
  setRequestToken('another-jwt')
  await flyreq.get('/api/user/me')
  note(`新 Authorization: ${rotated.calls.at(-1)?.headers?.Authorization}`)
}
