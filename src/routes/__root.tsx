import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { HeadContent, Scripts, createRootRouteWithContext } from '@tanstack/react-router'

import { Toaster } from '#/components/ui/sonner'
import { DEFAULT_THEME, THEME_INIT_SCRIPT } from '#/lib/theme'
import type { SessionUser } from '#/server/auth'
import { me } from '#/server/functions/auth'

import appCss from '../styles.css?url'

/**
 * The root loads the session ONCE, for everyone.
 *
 * It puts it in the router context: protected pages (under `_app`) only have to
 * read it, and none of them needs to ask again who is signed in. The access
 * check itself lives in `_app.tsx`, not here, so that /connexion can render
 * without looping on itself.
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
     * The server always renders the default theme: it has no way of knowing the
     * device's choice, which lives in `localStorage`. The script below corrects
     * the document before the first paint, and `suppressHydrationWarning` stops
     * React complaining about the gap it just created itself on the root
     * element.
     */
    <html lang="fr" className={DEFAULT_THEME === 'sombre' ? 'dark' : ''} suppressHydrationWarning>
      <head>
        <HeadContent />
        {/*
          After HeadContent, so the theme-color meta already exists when the
          script fixes it - and still before the first paint, since an inline
          script in the <head> blocks rendering.
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
