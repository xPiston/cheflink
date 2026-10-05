import { createFileRoute } from '@tanstack/react-router'

import { currentUser } from '#/server/auth'
import { connect } from '#/server/events'

/**
 * The entry point of the real-time stream.
 *
 * This handler does almost nothing, on purpose: it checks the session, then
 * hands the upgrade request to the Durable Object, which holds the connection.
 * The Worker holds nothing - it is not able to.
 *
 * Authentication happens HERE rather than in the Durable Object: the session
 * cookie and the database live on the Worker side, and the hub has no reason to
 * know what a user is.
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
