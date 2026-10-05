import { QueryClient } from '@tanstack/react-query'
import { createRouter as createTanStackRouter } from '@tanstack/react-router'

import { routeTree } from './routeTree.gen'

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        /**
         * Screens are refreshed by the real-time stream, not by a timer. So
         * TanStack Query's automatic refetching is turned off: it would
         * duplicate that work and, on a tablet left open all evening, mean
         * requests for nothing.
         */
        refetchOnWindowFocus: false,
        staleTime: 30_000,
        retry: 1,
      },
    },
  })

  return createTanStackRouter({
    routeTree,
    // `user` is filled in by the root's `beforeLoad`; it is declared here so
    // the context is complete from the moment the router is created.
    context: { queryClient, user: null },
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
