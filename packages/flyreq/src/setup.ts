import type { Requestor } from '@flyreq/core'
import { bootstrap, configureBus, type BusConfig } from '@flyreq/bus'
import {
  createBackend,
  getBackend,
  listBackends,
  markBackend,
  registerAdapter,
  registerBuiltinAdapters,
  type BackendName,
} from './adapters'
import { loadFlyreqConfig, type FlyreqFileConfig } from './config'

export interface SetupOptions extends BusConfig {
  /** Transport adapter name; default `axios` (or value from flyreq.config.json) */
  backend?: BackendName
  /** Options passed to the adapter factory (e.g. axios CreateAxiosDefaults) */
  adapterOptions?: unknown
  /** Skip reading flyreq.config.json */
  ignoreConfigFile?: boolean
  /** Working directory for config file lookup */
  cwd?: string
}

let bootstrapped = false

function ensureBuiltins(): void {
  if (!bootstrapped) {
    registerBuiltinAdapters()
    bootstrapped = true
  }
}

function isRequestor(value: unknown): value is Requestor {
  return (
    typeof value === 'object'
    && value != null
    && typeof (value as Requestor).request === 'function'
    && typeof (value as Requestor).get === 'function'
  )
}

/**
 * Switch transport backend and inject (with bus defaults).
 * Accepts a registered name or a custom Requestor instance.
 */
export function setBackend(
  nameOrRequestor: BackendName | Requestor,
  options?: unknown,
): Requestor {
  ensureBuiltins()
  if (isRequestor(nameOrRequestor)) {
    markBackend('custom')
    return bootstrap(nameOrRequestor)
  }
  const requestor = createBackend(nameOrRequestor, options)
  markBackend(nameOrRequestor)
  return bootstrap(requestor)
}

/**
 * One-shot setup: bus protocol + backend inject.
 * Reads `flyreq.config.json` when present (Node), unless `ignoreConfigFile`.
 */
export function setup(options: SetupOptions = {}): Requestor {
  ensureBuiltins()

  const fileConfig: FlyreqFileConfig = options.ignoreConfigFile
    ? {}
    : (loadFlyreqConfig(options.cwd) ?? {})

  const {
    backend: _b,
    adapterOptions: _a,
    ignoreConfigFile: _i,
    cwd: _c,
    ...busFromOptions
  } = options

  const busConfig: BusConfig = {
    baseURL: options.baseURL ?? fileConfig.baseURL,
    successCode: options.successCode ?? fileConfig.successCode,
    authHeader: options.authHeader ?? fileConfig.authHeader,
    getToken: options.getToken,
    ...busFromOptions,
  }
  configureBus(busConfig)

  const backend =
    options.backend
    ?? fileConfig.backend
    ?? getBackend()
    ?? 'axios'

  const adapterOptions = options.adapterOptions
  return setBackend(backend, adapterOptions)
}

export { registerAdapter, listBackends, getBackend, createBackend }
export type { BackendName, FlyreqFileConfig }
