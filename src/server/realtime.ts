import { DurableObject } from 'cloudflare:workers'

import type { AppEvent } from './events'

/**
 * Le hub temps reel : UN Durable Object pour tout le bar.
 *
 * POURQUOI un Durable Object. Un Worker est sans etat et replique : le bus en
 * memoire qui marchait sur un serveur unique ne peut pas fonctionner ici,
 * puisque l'ecran de la cuisine et le poste du bar peuvent tomber sur deux
 * isolats differents, voire deux continents. Un Durable Object est l'inverse :
 * exactement UNE instance pour un identifiant donne, partout dans le monde.
 * C'est le seul endroit de l'infrastructure Cloudflare ou "tout le monde
 * regarde le meme objet" a un sens, donc c'est la que vivent les connexions.
 *
 * POURQUOI l'hibernation. `acceptWebSocket` (plutot que `server.accept()`)
 * confie les sockets au runtime : l'objet peut etre evince de la memoire entre
 * deux commandes et les connexions RESTENT ouvertes. Une tablette branchee tout
 * le service ne facture donc pas une duree d'execution continue - elle ne coute
 * que lorsqu'une commande passe. Sans hibernation, un bar ouvert huit heures
 * tiendrait huit heures de Durable Object eveille.
 */
export class Realtime extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // --- Publication : appelee par les server functions, pas par un navigateur.
    if (url.pathname === '/publish') {
      const event = (await request.json()) as AppEvent
      this.#broadcast(event)

      return new Response(null, { status: 204 })
    }

    // --- Abonnement : l'ecran ouvre son WebSocket ici.
    if (request.headers.get('upgrade') !== 'websocket') {
      return new Response('WebSocket attendu.', { status: 426 })
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)

    this.ctx.acceptWebSocket(server)

    return new Response(null, { status: 101, webSocket: client })
  }

  /**
   * Les ecrans n'envoient rien d'utile : tout ce qu'ils font passe par des
   * server functions. On repond quand meme au ping pour que le client puisse
   * verifier que la connexion est vivante.
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
      // Deja ferme.
    }
  }

  #broadcast(event: AppEvent): void {
    const payload = JSON.stringify(event)

    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(payload)
      } catch {
        // Un socket mort ne doit pas empecher les autres d'etre servis ; le
        // runtime le retirera de lui-meme.
      }
    }
  }
}
