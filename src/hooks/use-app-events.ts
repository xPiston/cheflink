import { useEffect, useRef } from 'react'

import type { AppEvent } from '#/server/events'

type Options = {
  /** Appele a chaque evenement pousse par le serveur. */
  onEvent: (event: AppEvent) => void
  /**
   * Appele a CHAQUE ouverture de la connexion, y compris les reconnexions.
   *
   * C'est la piece qui empeche un ecran de rester fige. Un evenement n'est pas
   * rejoue : s'il part pendant que la tablette hydrate, pendant une coupure de
   * wifi ou pendant un redeploiement, il est perdu pour de bon - et l'ecran
   * afficherait "rien a preparer" avec une commande en attente en base.
   * Verifie en situation : une commande envoyee avant que l'ecran cuisine ne
   * soit connecte n'apparaissait jamais.
   *
   * On traite donc "la connexion vient de s'ouvrir" comme un point de
   * synchronisation : on recharge, et l'ecran repart de l'etat reel.
   */
  onConnect?: () => void
}

/** Un demi-seconde, puis le double a chaque echec, plafonne a dix secondes. */
const FIRST_RETRY_MS = 500
const MAX_RETRY_MS = 10_000

/**
 * Abonne l'ecran au flux temps reel du serveur (WebSocket).
 *
 * POURQUOI WebSocket et pas SSE. Sur Cloudflare, les connexions longues sont
 * tenues par un Durable Object (voir src/server/realtime.ts), et le WebSocket
 * est le seul transport que cette plateforme sait maintenir et diffuser a
 * plusieurs ecrans a la fois.
 *
 * Contrepartie assumee : `EventSource` reconnectait tout seul, `WebSocket` non.
 * La boucle ci-dessous fait ce travail, avec un recul exponentiel pour ne pas
 * marteler le serveur quand c'est lui qui est tombe. C'est peu de code, mais
 * c'est du code qui doit marcher : le wifi d'un bar tombe.
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
          // Un message illisible ne doit pas tuer la connexion.
        }
      })

      // `close` suffit : un `error` est toujours suivi d'un `close`, et
      // reprogrammer depuis les deux ouvrirait deux connexions.
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
