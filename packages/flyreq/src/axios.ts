/**
 * axios transport, kept out of the main entry.
 *
 * `@flyreq/axios` creates an axios instance at module scope, so a static
 * import from the main entry is unshakeable: every consumer would ship axios
 * even when using fetch. Importing this subpath is the opt-in.
 *
 * ```ts
 * import { setupFlyreq } from 'flyreq'
 * import { createAxiosRequestor } from 'flyreq/axios'
 *
 * setupFlyreq({ baseURL, backend: createAxiosRequestor() })
 * ```
 *
 * Name-based selection (`backend: 'axios'`, or `flyreq use axios` writing to
 * flyreq.config.json) needs the adapter registered first:
 *
 * ```ts
 * import { registerAxiosAdapter } from 'flyreq/axios'
 *
 * registerAxiosAdapter()
 * setupFlyreq({ baseURL, backend: 'axios' })
 * ```
 */
import { createAxiosRequestor, requestor as axiosRequestor } from '@flyreq/axios'
import { registerAdapter } from './adapters'

/** Register the axios adapter under the name `axios`. */
export function registerAxiosAdapter(): void {
  registerAdapter('axios', (options) =>
    createAxiosRequestor(options as Parameters<typeof createAxiosRequestor>[0]),
  )
}

export { createAxiosRequestor, axiosRequestor }
