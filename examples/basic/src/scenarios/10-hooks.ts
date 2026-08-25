/**
 * 场景：请求钩子 beforeRequest / responseBody / error
 *
 * 装饰器（缓存、重试…）内部也是这套事件。业务可自己挂。
 */
import {
  busCall,
  createEventfulRequestor,
  getRequestor,
} from 'flyreq'
import { bootMock, heading, note } from '../mock'

export async function runHooks(): Promise<void> {
  heading('1. beforeRequest 改请求头，responseBody 打点')
  const mock = bootMock({ label: 'hook' })
  const req = createEventfulRequestor(getRequestor())

  req.on('beforeRequest', (config) => {
    return {
      ...config,
      headers: { ...config.headers, 'X-Trace': 'example' },
    }
  })
  req.on('responseBody', (_config, resp) => {
    note(`responseBody status=${resp.status} ok=${resp.ok}`)
  })

  await busCall(req, 'GET', '/api/hook-ok')
  note(`发出的 X-Trace: ${mock.calls.at(-1)?.headers?.['X-Trace']}`)

  heading('2. error：传输抛错时旁路记录，再继续抛给调用方')
  bootMock({ failTimes: 1, label: 'hook-err' })
  const failing = createEventfulRequestor(getRequestor())
  failing.on('error', (_config, error) => {
    note(`error 钩子: ${(error as Error).message}`)
  })
  try {
    await busCall(failing, 'GET', '/api/hook-fail')
  }
  catch {
    note('调用方仍然收到异常，可自行提示 UI')
  }
}
