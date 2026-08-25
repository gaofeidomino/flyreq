/**
 * 场景：请求重试
 *
 * 传输抛错时按 maxCount 重试。也可在 setupFlyreq({ retry: 3 }) 设全局默认。
 */
import { flyreq } from 'flyreq'
import { bootMock, heading, note } from '../mock'

export async function runRetry(): Promise<void> {
  heading('1. 调用级 retry：前 2 次失败，第 3 次成功')
  const mock = bootMock({ failTimes: 2, label: 'retry' })
  const data = await flyreq.get<{ call: number }>('/api/unstable', { retry: 5 })
  note(`成功时 call=${data.call}，实际请求次数=${mock.calls.length}`)

  heading('2. shouldRetry：只对某类错误重试')
  const mock2 = bootMock({ failTimes: 3, label: 'should' })
  await flyreq.get('/api/unstable', {
    retry: {
      maxCount: 5,
      delay: 0,
      shouldRetry: error => String(error).includes('simulated failure'),
    },
  })
  note(`shouldRetry 通过后次数=${mock2.calls.length}`)

  heading('3. 不设 retry 则失败一次即抛出')
  bootMock({ failTimes: 1, label: 'once' })
  try {
    await flyreq.get('/api/unstable')
  }
  catch (err) {
    note(`裸请求失败: ${(err as Error).message}`)
  }
}
