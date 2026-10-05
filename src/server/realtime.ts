import { DurableObject } from 'cloudflare:workers'

import type { AppEvent } from './events'

/**
 * The real-time hub: ONE Durable Object for the whole bar.
 *
 * WHY a Durable Object. A Worker is stateless and replicated: the in-memory bus
 * that worked on a single server cannot work here, because the kitchen screen
 * and the bar station may land on two different isolates, or two continents. A
 * Durable Object is the opposite: exactly ONE instance for a given id, anywhere
 * in the world. It is the only place in Cloudflare's infrastructure where
 * "everyone is looking at the same object" means something, so that is where
 * the connections live.
 *
 * WHY hibernation. `acceptWebSocket` (rather than `server.accept()`) hands the
 * sockets to the runtime: the object can be evicted from memory between orders
 * while the connections STAY open. A tablet plugged in for a whole shift
 * therefore does not bill continuous execution time - it only costs when an
 * order goes through. Without hibernation, a bar open for eight hours would
 * hold eight hours of an awake Durable Object.
 */
export class Realtime extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // --- Publish: called by the server functions, never by a browser.
    if (url.pathname === '/publish') {
      const event = (await request.json()) as AppEvent
      this.#broadcast(event)

      return new Response(null, { status: 204 })
    }

    // --- Subscribe: this is where a screen opens its WebSocket.
    if (request.headers.get('upgrade') !== 'websocket') {
      return new Response('WebSocket attendu.', { status: 426 })
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)

    this.ctx.acceptWebSocket(server)

    return new Response(null, { status: 101, webSocket: client })
  }

  /**
   * Screens send nothing useful: everything they do goes through server
   * functions. We still answer a ping so the client can check the connection is
   * alive.
   */
  webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): void {
    if (message === 'ping') {
      socket.send('pong')
    }
  }

  webSocketError(socket: WebSocket): void {
    try {
      socket.close(1011, 'erreur')
    } catch {
      // Already closed.
    }
  }

  #broadcast(event: AppEvent): void {
    const payload = JSON.stringify(event)

    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(payload)
      } catch {
        // A dead socket must not stop the others from being served; the
        // runtime will drop it on its own.
      }
    }
  }
}
