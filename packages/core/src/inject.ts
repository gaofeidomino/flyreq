import type { Requestor } from './types'

let injected: Requestor | undefined

export function inject(requestor: Requestor): void {
  injected = requestor
}

export function useRequestor(): Requestor {
  if (!injected) {
    throw new Error(
      '[flyreq] No Requestor injected. Call inject(requestor) first, or pass { base } to factories.',
    )
  }
  return injected
}

export function resetRequestor(): void {
  injected = undefined
}

/** Prefer explicit base, otherwise fall back to injected requestor */
export function resolveBase(base?: Requestor): Requestor {
  return base ?? useRequestor()
}
