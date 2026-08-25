/**
 * 场景：DIP 接线 —— setupFlyreq / bootstrapRequestor / 切换传输
 *
 * request-core 只依赖 Requestor 接口。
 * 换实现 = 换注入，不必改 core。
 */
import {
  bootstrapRequestor,
  busCall,
  getBackend,
  listBackends,
  registerAdapter,
  resetRequestor,
  setBackend,
  setRequestToken,
  setupFlyreq,
  getRequestor,
} from 'flyreq'
import { createMockRequestor, heading, note } from '../mock'

export async function runSetup(): Promise<void> {
  heading('1. setupFlyreq()：注册实现后一键注入（业务侧最常用）')
  resetRequestor()
  const mockA = createMockRequestor({ label: 'setup' })
  registerAdapter('mock', () => mockA.requestor)
  setupFlyreq({
    baseURL: 'https://api.example.com',
    backend: 'mock',
    ignoreConfigFile: true,
  })
  setRequestToken('demo-token')
  note(`当前 backend: ${getBackend()}`)
  note(`已注册: ${listBackends().join(', ')}`)
  await busCall(getRequestor(), 'GET', '/api/ping')

  heading('2. bootstrapRequestor(requestor)：composition root（对应 RES.md 的 inject）')
  const mockB = createMockRequestor({ label: 'bootstrap' })
  bootstrapRequestor(mockB.requestor, { baseURL: 'https://api.example.com' })
  const ping = await busCall<{ url: string }>(getRequestor(), 'GET', '/api/ping')
  note(`解包后的 data: ${JSON.stringify(ping)}`)

  heading('3. setBackend：运行时换实现，core 无感知')
  setBackend(mockA.requestor)
  await busCall(getRequestor(), 'GET', '/api/switch')
  note(`换回 A 后: setup-calls=${mockA.calls.length} bootstrap-calls=${mockB.calls.length}`)
  note('内置还可 setBackend("axios" | "fetch" | "xhr")，或 flyreq use fetch')
}
