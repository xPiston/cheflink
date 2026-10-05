/**
 * Extra Worker exports.
 *
 * Nitro picks this file up and adds its exports to the Worker entrypoint. That
 * is what lets Cloudflare find the `Realtime` class named in `wrangler.jsonc`:
 * a Durable Object binding points at a class exported by the Worker, and the
 * handler Nitro generates only exports itself.
 *
 * No default export here: it would collide with Nitro's.
 */
export { Realtime } from './src/server/realtime'
