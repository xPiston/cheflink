import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { HeadContent, Scripts, createRootRouteWithContext } from '@tanstack/react-router'

import { Toaster } from '#/components/ui/sonner'
import { DEFAULT_THEME, THEME_INIT_SCRIPT } from '#/lib/theme'
import { getLocale } from '#/paraglide/runtime'
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
    links: [
      { rel: 'stylesheet', href: appCss },
      /**
       * The tab's icon, in the order a browser walks them.
       *
       * The SVG comes first with `sizes="any"`: it scales to whatever the tab,
       * the bookmarks bar and the taskbar ask for, and every current browser
       * reads it. The `.ico` follows with its real sizes for the ones that do
       * not - and for the bare `/favicon.ico` some agents request on their own,
       * which is a 404 and a blank tab otherwise. Apple is last because it
       * wants its own name, its own size and no transparency: it ignores both
       * of the above and falls back on the first 404 it finds.
       */
      { rel: 'icon', type: 'image/svg+xml', sizes: 'any', href: '/favicon.svg' },
      { rel: 'icon', href: '/favicon.ico', sizes: '16x16 32x32 48x48' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
    ],
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
     *
     * `lang`, on the other hand, IS known server-side: the locale lives in a
     * cookie, which is exactly why it is kept in one rather than in
     * `localStorage` like the theme. `src/server.ts` resolves it before this
     * renders, so the client hydrates with the same value and there is nothing
     * to reconcile - and no flash of the wrong language.
     */
    <html
      lang={getLocale()}
      className={DEFAULT_THEME === 'sombre' ? 'dark' : ''}
      suppressHydrationWarning
    >
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
