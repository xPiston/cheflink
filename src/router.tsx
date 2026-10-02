import { QueryClient } from '@tanstack/react-query'
import { createRouter as createTanStackRouter } from '@tanstack/react-router'

import { routeTree } from './routeTree.gen'

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        /**
         * Les ecrans sont rafraichis par le flux SSE, pas par un minuteur. On
         * coupe donc les recuperations automatiques de TanStack Query : elles
         * feraient double emploi et, sur une tablette laissee ouverte toute la
         * soiree, des requetes pour rien.
         */
        refetchOnWindowFocus: false,
        staleTime: 30_000,
        retry: 1,
      },
    },
  })

  return createTanStackRouter({
    routeTree,
    // `user` est rempli par le `beforeLoad` de la racine ; il est declare ici
    // pour que le contexte soit complet des la creation du routeur.
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
