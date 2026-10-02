import { getRequest } from '@tanstack/react-start/server'

import type { Realtime } from './realtime'

/**
 * Les bindings Cloudflare de la requete en cours.
 *
 * Sur Workers, il n'y a pas de variable globale qui tienne la base : un binding
 * appartient a une requete, et Nitro l'attache a l'objet `Request`. C'est aussi
 * ce qui rend l'emulation locale (Miniflare, via `wrangler.jsonc`) identique a
 * la production - on lit le binding au meme endroit dans les deux cas.
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
