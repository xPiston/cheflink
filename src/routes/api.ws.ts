import { createFileRoute } from '@tanstack/react-router'

import { currentUser } from '#/server/auth'
import { connect } from '#/server/events'

/**
 * Le point d'entree du flux temps reel.
 *
 * Ce handler ne fait presque rien, et c'est voulu : il verifie la session, puis
 * passe la requete d'upgrade au Durable Object, qui garde la connexion. Le
 * Worker, lui, ne tient rien - il n'en est pas capable.
 *
 * L'authentification est faite ICI plutot que dans le Durable Object : le
 * cookie de session et la base vivent cote Worker, et le hub n'a aucune raison
 * de savoir ce qu'est un utilisateur.
 */
export const Route = createFileRoute('/api/ws')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await currentUser())) {
          return new Response('Connexion requise.', { status: 401 })
        }

        return connect(request)
      },
    },
  },
})
