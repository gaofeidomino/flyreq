/**
 * 场景：请求重试
 *
 * 传输抛错时按 maxCount 重试。HTTP 4xx/5xx 若被实现层吞掉（不 throw）则不会重试。
 */
import { busCall, createRetryRequestor, getRequestor } from 'flyreq'
import { bootMock, heading, note } from '../mock'

export async function runRetry(): Promise<void> {
  heading('1. 前 2 次失败，第 3 次成功（maxCount = 5）')
  const mock = bootMock({ failTimes: 2, label: 'retry' })
  const retry = createRetryRequestor(5)
  const data = await busCall<{ call: number }>(retry, 'GET', '/api/unstable')
  note(`成功时 call=${data.call}，实际请求次数=${mock.calls.length}`)

  heading('2. shouldRetry：只对某类错误重试')
  const mock2 = bootMock({ failTimes: 3, label: 'should' })
  const selective = createRetryRequestor({
    maxCount: 5,
    delay: 0,
    shouldRetry: (error) => String(error).includes('simulated failure'),
  })
  await busCall(selective, 'GET', '/api/unstable')
  note(`shouldRetry 通过后次数=${mock2.calls.length}`)

  heading('3. 不包一层则不会重试')
  bootMock({ failTimes: 1, label: 'once' })
  try {
    await busCall(getRequestor(), 'GET', '/api/unstable')
  }
  catch (err) {
    note(`裸请求失败: ${(err as Error).message}`)
  }
}
