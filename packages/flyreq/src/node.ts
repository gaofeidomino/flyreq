/**
 * Node-only entry. Kept out of the main entry so bundlers never pull
 * `node:fs` / `node:path` into a browser bundle.
 *
 * ```ts
 * import { setupFlyreqFromConfig } from 'flyreq/node'
 * setupFlyreqFromConfig() // reads flyreq.config.json, then setupFlyreq()
 * ```
 */
import type { Requestor } from '@flyreq/core'
import { loadFlyreqConfig, writeFlyreqConfig, type FlyreqFileConfig } from './config'
import { setupFlyreq, type SetupFlyreqOptions } from './setup'

export interface SetupFlyreqFromConfigOptions extends SetupFlyreqOptions {
  /** Where to look for flyreq.config.json; defaults to process.cwd() */
  cwd?: string
}

function prefer<T>(explicit: T | undefined, fromFile: T | undefined): T | undefined {
  return explicit !== undefined ? explicit : fromFile
}

/** Read `flyreq.config.json` and set up. Explicit options win over the file. */
export function setupFlyreqFromConfig(options: SetupFlyreqFromConfigOptions = {}): Requestor {
  const { cwd, ...rest } = options
  const file: FlyreqFileConfig = loadFlyreqConfig(cwd) ?? {}

  return setupFlyreq({
    ...rest,
    baseURL: prefer(rest.baseURL, file.baseURL),
    successCode: prefer(rest.successCode, file.successCode),
    authHeader: prefer(rest.authHeader, file.authHeader),
    backend: prefer(rest.backend, file.backend),
  })
}

export { loadFlyreqConfig, writeFlyreqConfig }
export type { FlyreqFileConfig }
