import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface FlyreqFileConfig {
  backend?: string
  /** 接口平台 URL — `flyreq gen` pulls latest API JSON from here */
  platform?: string
  baseURL?: string
  successCode?: number
  authHeader?: string
  [key: string]: unknown
}

function canUseNodeFs(): boolean {
  return typeof process !== 'undefined' && typeof process.cwd === 'function'
}

/** Sync-load flyreq.config.json from cwd (Node only). */
export function loadFlyreqConfig(cwd?: string): FlyreqFileConfig | undefined {
  if (!canUseNodeFs()) return undefined
  const root = cwd ?? process.cwd()
  const file = join(root, 'flyreq.config.json')
  if (!existsSync(file)) return undefined
  try {
    const raw = readFileSync(file, 'utf8')
    return JSON.parse(raw) as FlyreqFileConfig
  }
  catch (err) {
    console.warn('[flyreq] failed to read flyreq.config.json:', err)
    return undefined
  }
}

export function writeFlyreqConfig(config: FlyreqFileConfig, cwd?: string): string {
  if (!canUseNodeFs()) {
    throw new Error('[flyreq] writeFlyreqConfig requires Node.js')
  }
  const root = cwd ?? process.cwd()
  const file = join(root, 'flyreq.config.json')
  let existing: FlyreqFileConfig = {}
  if (existsSync(file)) {
    try {
      existing = JSON.parse(readFileSync(file, 'utf8')) as FlyreqFileConfig
    }
    catch {
      existing = {}
    }
  }
  const next = { ...existing, ...config }
  writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  return file
}
