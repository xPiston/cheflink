import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { HeadContent, Scripts, createRootRouteWithContext } from '@tanstack/react-router'

import { Toaster } from '#/components/ui/sonner'
import { DEFAULT_THEME, THEME_INIT_SCRIPT } from '#/lib/theme'
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
    /**
     * Le serveur rend toujours le theme par defaut : il n'a aucun moyen de
     * connaitre le choix de l'appareil, qui vit dans `localStorage`. Le script
     * ci-dessous corrige le document avant le premier affichage, et
     * `suppressHydrationWarning` evite que React se plaigne de l'ecart qu'il
     * vient lui-meme de creer sur l'element racine.
     */
    <html lang="fr" className={DEFAULT_THEME === 'sombre' ? 'dark' : ''} suppressHydrationWarning>
      <head>
        <HeadContent />
        {/*
          Apres HeadContent, pour que la meta theme-color existe deja quand le
          script la corrige - et toujours avant le premier affichage, puisqu'un
          script en ligne dans le <head> bloque le rendu.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
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
