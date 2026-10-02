import { drizzle } from 'drizzle-orm/d1'

import { bindings } from '#/server/cloudflare'
import * as schema from './schema'

/**
 * La base, pour la requete en cours.
 *
 * D1 est le SQLite manage de Cloudflare. Contrairement a un fichier local, il
 * n'y a RIEN a garder entre deux requetes : le binding est fourni par la
 * plateforme a chaque appel, et `drizzle()` n'est qu'une enveloppe sans etat
 * autour de lui. D'ou une fonction et non un singleton exporte - un singleton
 * capturerait le binding d'une requete pour le reutiliser dans une autre, ce
 * que le runtime interdit.
 *
 * Deux consequences qui se voient ailleurs dans le code :
 *   - pas de transaction multi-requetes. D1 n'expose pas `BEGIN`/`COMMIT` ; les
 *     ecritures groupees passent par `batch()`, qui est atomique (voir
 *     src/server/functions/orders.ts) ;
 *   - les migrations ne tournent plus au demarrage mais par
 *     `npm run db:migrate` (`wrangler d1 migrations apply`) : un Worker n'a pas
 *     de "demarrage" ou poser ce genre de chose.
 */
export function getDb() {
  return drizzle(bindings().DB, { schema })
}

export type Db = ReturnType<typeof getDb>
