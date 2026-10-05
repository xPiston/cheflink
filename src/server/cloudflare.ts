import { getRequest } from '@tanstack/react-start/server'

import type { Realtime } from './realtime'

/**
 * The Cloudflare bindings of the current request.
 *
 * On Workers there is no global variable holding the database: a binding
 * belongs to a request, and Nitro attaches it to the `Request` object. That is
 * also what makes local emulation (Miniflare, through `wrangler.jsonc`)
 * identical to production - the binding is read from the same place in both.
 */
export type Bindings = {
  DB: D1Database
  REALTIME: DurableObjectNamespace<Realtime>
}

export class MissingBindingsError extends Error {
  constructor() {
    super(
      "Bindings Cloudflare introuvables. Lancez l'application avec `npm run dev` " +
        '(Nitro + Miniflare) ou deployez-la ; `vite preview` seul ne les fournit pas.'
    )
    this.name = 'MissingBindingsError'
  }
}

export function bindings(): Bindings {
  const request = getRequest() as Request & {
    runtime?: { cloudflare?: { env?: Partial<Bindings> } }
  }

  const env = request.runtime?.cloudflare?.env
  if (!env?.DB || !env.REALTIME) {
    throw new MissingBindingsError()
  }

  return env as Bindings
}
