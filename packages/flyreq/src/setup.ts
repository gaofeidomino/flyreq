import type { Requestor } from '@flyreq/core'
import { bootstrapRequestor, configureBus, configureFlyreq, type BusConfig, type FlyreqRetry } from '@flyreq/bus'
import {
  createBackend,
  getBackend,
  listBackends,
  markBackend,
  registerAdapter,
  registerBuiltinAdapters,
  type BackendName,
} from './adapters'

export interface SetupFlyreqOptions extends BusConfig {
  /** Transport adapter name; default `axios` */
  backend?: BackendName
  /** Options passed to the adapter factory (e.g. axios CreateAxiosDefaults) */
  adapterOptions?: unknown
  /** Default retry policy for `flyreq.get/post/...` (override per call). */
  retry?: FlyreqRetry
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
    return bootstrapRequestor(nameOrRequestor)
  }
  const requestor = createBackend(nameOrRequestor, options)
  markBackend(nameOrRequestor)
  return bootstrapRequestor(requestor)
}

/**
 * One-shot setup: bus protocol + backend inject.
 *
 * Stays free of Node APIs so bundlers never pull `node:fs` into a browser
 * bundle. To read `flyreq.config.json`, use `setupFlyreqFromConfig` from
 * `flyreq/node`.
 */
export function setupFlyreq(options: SetupFlyreqOptions = {}): Requestor {
  ensureBuiltins()

  const { backend, adapterOptions, retry, ...busConfig } = options

  configureBus(busConfig)
  configureFlyreq({ retry })

  return setBackend(backend ?? getBackend() ?? 'axios', adapterOptions)
}

export { registerAdapter, listBackends, getBackend, createBackend }
export type { BackendName }
