import { bindings } from './cloudflare'

/**
 * What the server pushes to the open screens.
 *
 * Events carry ONLY identifiers, never whole orders: screens refetch when the
 * signal arrives. That is one extra round trip, but it avoids two
 * representations of the same order drifting apart, and it keeps the payload
 * harmless.
 */
export type AppEvent =
  | { type: 'order.created'; orderId: string }
  | { type: 'order.completed'; orderId: string }
  | { type: 'dishes.changed' }

/**
 * The bar has one room: one hub, so one Durable Object id. The day this serves
 * several venues, this constant becomes the venue's id - and nothing else
 * moves.
 */
const HUB = 'salle'

const DEGRADED =
  'The real-time Durable Object is not available. That is expected under `npm run dev`, ' +
  'where Nitro does not publish exports.cloudflare.ts: the screens will only catch up on ' +
  'the safety refresh. Use `npm run preview` for the full Cloudflare runtime.'

function hub() {
  const { REALTIME } = bindings()

  return REALTIME.get(REALTIME.idFromName(HUB))
}

/**
 * Broadcasts an event to every connected screen.
 *
 * A hub failure must NOT fail the write that just happened: an order that is
 * saved but not broadcast is recoverable - screens resynchronise on reconnect
 * and on the safety-net refetch - whereas a lost order is not. So we log
 * loudly and carry on rather than roll back.
 *
 * The URL passed to the stub is arbitrary: a Durable Object does not answer on
 * the network, this is a direct call, and only the path acts as internal
 * routing (see Realtime.fetch).
 */
export async function publish(event: AppEvent): Promise<void> {
  try {
    await hub().fetch('https://hub/publish', {
      method: 'POST',
      body: JSON.stringify(event),
    })
  } catch (error) {
    console.warn(`[cheflink] event ${event.type} was not broadcast. ${DEGRADED}`, error)
  }
}

/** Forwards to the hub the request of a screen opening its WebSocket. */
export async function connect(request: Request): Promise<Response> {
  try {
    return await hub().fetch(request)
  } catch (error) {
    console.warn(`[cheflink] real-time connection refused. ${DEGRADED}`, error)

    // 503 rather than 500: the client should understand it can retry, which
    // is what the reconnect loop in useAppEvents does.
    return new Response(DEGRADED, { status: 503 })
  }
}
