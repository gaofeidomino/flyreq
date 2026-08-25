/**
 * 场景：串行 / 并发控制
 */
import { createParallelRequestor, createSerialRequestor } from 'flyreq'
import { bootMock, heading, note } from '../mock'

export async function runFlowControl(): Promise<void> {
  heading('1. 串行：后一个等前一个结束（顺序稳定）')
  const serialMock = bootMock({ delayMs: 30, label: 'serial' })
  const serial = createSerialRequestor()
  const t0 = Date.now()
  await Promise.all([
    serial.get('/1'),
    serial.get('/2'),
    serial.get('/3'),
  ])
  note(`完成顺序 URL: ${serialMock.calls.map((c) => c.url).join(' → ')}`)
  note(`耗时 ${Date.now() - t0}ms（约 3 × delay）`)

  heading('2. 并发上限 maxCount=2，4 个请求同时发起')
  const parallelMock = bootMock({ delayMs: 40, label: 'parallel' })
  const parallel = createParallelRequestor(2)
  const t1 = Date.now()
  await Promise.all([
    parallel.get('/a'),
    parallel.get('/b'),
    parallel.get('/c'),
    parallel.get('/d'),
  ])
  note(`峰值并发=${parallelMock.maxActive}（应为 2）`)
  note(`耗时 ${Date.now() - t1}ms（约 2 批 × delay）`)
}
