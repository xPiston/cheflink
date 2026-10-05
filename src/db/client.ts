import { drizzle } from 'drizzle-orm/d1'

import { bindings } from '#/server/cloudflare'
import * as schema from './schema'

/**
 * The database, for the current request.
 *
 * D1 is Cloudflare's managed SQLite. Unlike a local file, there is NOTHING to
 * keep between two requests: the platform hands over the binding on every call,
 * and `drizzle()` is only a stateless wrapper around it. Hence a function
 * rather than an exported singleton - a singleton would capture one request's
 * binding and reuse it in another, which the runtime forbids.
 *
 * Two consequences visible elsewhere in the code:
 *   - no multi-statement transactions. D1 exposes no `BEGIN`/`COMMIT`; grouped
 *     writes go through `batch()`, which is atomic (see
 *     src/server/functions/orders.ts);
 *   - migrations no longer run at startup but through `npm run db:migrate`
 *     (`wrangler d1 migrations apply`): a Worker has no "startup" to hang that
 *     kind of thing on.
 */
export function getDb() {
  return drizzle(bindings().DB, { schema })
}

export type Db = ReturnType<typeof getDb>
