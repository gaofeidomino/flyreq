import type { Requestor } from './types'

let injected: Requestor | undefined

export function injectRequestor(requestor: Requestor): void {
  injected = requestor
}

export function getRequestor(): Requestor {
  if (!injected) {
    throw new Error(
      '[flyreq] No Requestor injected. Call injectRequestor(requestor) first, or pass { base } to factories.',
    )
  }
  return injected
}

export function resetRequestor(): void {
  injected = undefined
}

/** Prefer explicit base, otherwise fall back to the injected requestor */
export function resolveBase(base?: Requestor): Requestor {
  return base ?? getRequestor()
}
