import { useEffect, useRef } from 'react'

import type { AppEvent } from '#/server/events'

type Options = {
  /** Called on every event pushed by the server. */
  onEvent: (event: AppEvent) => void
  /**
   * Called on EVERY open of the connection, reconnections included.
   *
   * This is the piece that keeps a screen from going stale. An event is never
   * replayed: if it fires while the tablet is hydrating, during a wifi drop or
   * during a redeploy, it is lost for good - and the screen would show
   * "nothing to prepare" with an order sitting in the database. Seen for real:
   * an order sent before the kitchen screen had connected never appeared.
   *
   * So "the connection just opened" is treated as a synchronisation point: we
   * refetch, and the screen starts again from the real state.
   */
  onConnect?: () => void
}

/** Half a second, then double on each failure, capped at ten seconds. */
const FIRST_RETRY_MS = 500
const MAX_RETRY_MS = 10_000

/**
 * Subscribes the screen to the server's real-time stream (WebSocket).
 *
 * WHY WebSocket rather than SSE. On Cloudflare, long-lived connections are held
 * by a Durable Object (see src/server/realtime.ts), and the WebSocket is the
 * only transport this platform can keep alive and fan out to several screens at
 * once.
 *
 * The trade-off we accepted: `EventSource` reconnected on its own, `WebSocket`
 * does not. The loop below does that work, with exponential backoff so it does
 * not hammer a server that is the thing which went down. It is little code, but
 * it is code that has to work: the wifi in a bar does drop.
 */
export function useAppEvents({ onEvent, onConnect }: Options): void {
  const handlers = useRef({ onEvent, onConnect })
  handlers.current = { onEvent, onConnect }

  useEffect(() => {
    let socket: WebSocket | null = null
    let retry: ReturnType<typeof setTimeout> | undefined
    let delay = FIRST_RETRY_MS
    let closed = false

    const open = () => {
      if (closed) {
        return
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      socket = new WebSocket(`${protocol}//${window.location.host}/api/ws`)

      socket.addEventListener('open', () => {
        delay = FIRST_RETRY_MS
        handlers.current.onConnect?.()
      })

      socket.addEventListener('message', (message) => {
        if (message.data === 'pong') {
          return
        }

        try {
          handlers.current.onEvent(JSON.parse(message.data as string) as AppEvent)
        } catch {
          // An unreadable message must not kill the connection.
        }
      })

      // `close` is enough: an `error` is always followed by a `close`, and
      // rescheduling from both would open two connections.
      socket.addEventListener('close', () => {
        if (closed) {
          return
        }

        retry = setTimeout(open, delay)
        delay = Math.min(delay * 2, MAX_RETRY_MS)
      })
    }

    open()

    return () => {
      closed = true
      clearTimeout(retry)
      socket?.close()
    }
  }, [])
}
