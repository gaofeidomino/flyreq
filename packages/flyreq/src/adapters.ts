import type { Requestor } from '@flyreq/core'
import { createFetchRequestor } from '@flyreq/fetch'
import { createXhrRequestor } from '@flyreq/xhr'

export type BackendName = string

export type AdapterFactory = (options?: unknown) => Requestor

const adapters = new Map<BackendName, AdapterFactory>()

let currentBackend: BackendName | undefined

export function registerAdapter(name: BackendName, factory: AdapterFactory): void {
  if (!name) throw new Error('[flyreq] adapter name is required')
  adapters.set(name, factory)
}

export function listBackends(): BackendName[] {
  return [...adapters.keys()]
}

export function getBackend(): BackendName | undefined {
  return currentBackend
}

export function hasAdapter(name: BackendName): boolean {
  return adapters.has(name)
}

/** Create a Requestor from a registered adapter (does not inject). */
export function createBackend(name: BackendName, options?: unknown): Requestor {
  const factory = adapters.get(name)
  if (!factory) {
    throw new Error(
      `[flyreq] Unknown backend "${name}". Registered: ${listBackends().join(', ') || '(none)'}. `
      + (name === 'axios'
        ? `axios ships separately so it stays out of bundles that do not use it — `
        + `call registerAxiosAdapter() from "flyreq/axios" first.`
        : `Use registerAdapter() for custom transports.`),
    )
  }
  return factory(options)
}

export function markBackend(name: BackendName): void {
  currentBackend = name
}

/**
 * Built-in adapters — call once at umbrella bootstrap.
 *
 * Only the dependency-free transports are built in. axios lives behind the
 * `flyreq/axios` subpath: importing it here would statically pull ~48 kB of
 * axios into every bundle, including ones that only ever use fetch.
 */
export function registerBuiltinAdapters(): void {
  if (!adapters.has('fetch')) {
    registerAdapter('fetch', (options) =>
      createFetchRequestor(options as Parameters<typeof createFetchRequestor>[0]),
    )
  }
  if (!adapters.has('xhr')) {
    registerAdapter('xhr', (options) =>
      createXhrRequestor(options as Parameters<typeof createXhrRequestor>[0]),
    )
  }
}
