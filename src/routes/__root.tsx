import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { HeadContent, Scripts, createRootRouteWithContext } from '@tanstack/react-router'

import { Toaster } from '#/components/ui/sonner'
import type { SessionUser } from '#/server/auth'
import { me } from '#/server/functions/auth'

import appCss from '../styles.css?url'

/**
 * La racine charge la session UNE fois, pour tout le monde.
 *
 * Elle la met dans le contexte du routeur : les pages protegees (sous `_app`)
 * n'ont plus qu'a la lire, et aucune n'a besoin de redemander qui est
 * connecte. Le controle d'acces lui-meme vit dans `_app.tsx`, pas ici, pour
 * que /connexion puisse s'afficher sans boucler sur elle-meme.
 */
export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
  user: SessionUser | null
}>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'theme-color', content: '#0a0a0a' },
      { title: 'ChefLink' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  beforeLoad: async () => ({ user: await me() }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const { queryClient } = Route.useRouteContext()

  return (
    // `dark` en dur : l'ecran de la cuisine est souvent dans un coin sombre, et
    // un fond blanc en pleine nuit de service est une mauvaise idee.
    <html lang="fr" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster position="top-center" richColors />
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}
