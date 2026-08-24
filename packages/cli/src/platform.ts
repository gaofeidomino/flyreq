import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { ApiJson } from './generate'

export function isRemoteSource(source: string): boolean {
  return /^https?:\/\//i.test(source)
}

/**
 * Load API JSON from a local file or the 接口平台 URL.
 */
export async function loadApiJson(source: string): Promise<ApiJson> {
  if (isRemoteSource(source)) {
    const res = await fetch(source)
    if (!res.ok) {
      throw new Error(`[flyreq] failed to pull interface config from ${source}: HTTP ${res.status}`)
    }
    return res.json() as Promise<ApiJson>
  }
  const raw = await readFile(resolve(source), 'utf8')
  return JSON.parse(raw) as ApiJson
}
