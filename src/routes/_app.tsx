import { useMutation } from '@tanstack/react-query'
import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
  useLocation,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { ChefHat, ClipboardList, History, LogOut, Moon, Sun, UtensilsCrossed, Wine } from 'lucide-react'
import { useEffect } from 'react'

import { Button } from '#/components/ui/button'
import { LOCALE_LABEL } from '#/lib/locale'
import { useMode, type Mode } from '#/lib/mode'
import { useTheme } from '#/lib/theme'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'
import { getLocale, setLocale } from '#/paraglide/runtime'
import { logout } from '#/server/functions/auth'

/**
 * The shell of the authenticated pages.
 *
 * A pathless route (the `_` in the name): it adds nothing to the URL, it only
 * brings the shared header and the access guard. Everything below it is
 * protected by construction - you cannot forget to protect a page, you just
 * have to put it in the right place.
 */
export const Route = createFileRoute('/_app')({
  beforeLoad: ({ context }) => {
    if (!context.user) {
      throw redirect({ to: '/connexion' })
    }

    return { user: context.user }
  },
  component: AppLayout,
})

function AppLayout() {
  const { user } = Route.useRouteContext()
  const [mode, setMode] = useMode()
  const [theme, setTheme] = useTheme()
  const navigate = useNavigate()
  const router = useRouter()
  const { pathname } = useLocation()

  /**
   * The URL wins on which mode is shown.
   *
   * Without this, opening /cuisine from a bookmark or a link leaves the header
   * on "Bar" with the bar's navigation while the screen shows the kitchen - and
   * the selector looks broken. `/plats` changes nothing: it serves both modes.
   */
  useEffect(() => {
    if (pathname.startsWith('/cuisine') && mode !== 'cuisine') {
      setMode('cuisine')
    }
    if (pathname.startsWith('/bar') && mode !== 'bar') {
      setMode('bar')
    }
  }, [pathname, mode, setMode])

  const signOut = useMutation({
    mutationFn: () => logout(),
    onSuccess: async () => {
      await router.invalidate()
      await navigate({ to: '/connexion' })
    },
  })

  /**
   * Switching mode takes you to the matching screen. Without that, flipping to
   * "cuisine" from the bar's history would do nothing visible, and the button
   * would look broken.
   */
  const switchMode = (next: Mode) => {
    setMode(next)
    void navigate({ to: next === 'cuisine' ? '/cuisine' : '/bar' })
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="mr-auto flex items-center gap-2 font-semibold">
            <UtensilsCrossed className="size-5 text-primary" aria-hidden />
            ChefLink
          </div>

          {/* The mode selector: wide targets, the tablet is tapped by finger. */}
          <div
            className="flex items-center rounded-lg border border-border/60 p-1"
            role="group"
            aria-label={m.shell_device_mode()}
          >
            <ModeButton
              active={mode === 'bar'}
              onClick={() => switchMode('bar')}
              icon={<Wine className="size-4" aria-hidden />}
              label={m.shell_mode_bar()}
            />
            <ModeButton
              active={mode === 'cuisine'}
              onClick={() => switchMode('cuisine')}
              icon={<ChefHat className="size-4" aria-hidden />}
              label={m.shell_mode_kitchen()}
            />
          </div>

          <nav className="flex items-center gap-1">
            {mode === 'bar' ? (
              <>
                <NavLink to="/bar" icon={<ClipboardList className="size-4" aria-hidden />}>
                  {m.nav_take_order()}
                </NavLink>
                <NavLink to="/bar/historique" icon={<History className="size-4" aria-hidden />}>
                  {m.nav_history()}
                </NavLink>
                <NavLink to="/plats" icon={<UtensilsCrossed className="size-4" aria-hidden />}>
                  {m.nav_dishes()}
                </NavLink>
              </>
            ) : (
              <NavLink to="/cuisine" icon={<ChefHat className="size-4" aria-hidden />}>
                {m.nav_orders()}
              </NavLink>
            )}
          </nav>

          <div className="flex items-center gap-2 border-l border-border/60 pl-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.name}</span>

            {/*
              The icon shows what you switch TO, not the current state: in dark
              we offer the sun. The current state is read off the screen itself.
            */}
            <Button
              variant="ghost"
              size="icon"
              aria-label={theme === 'sombre' ? m.shell_switch_to_light() : m.shell_switch_to_dark()}
              onClick={() => setTheme(theme === 'sombre' ? 'clair' : 'sombre')}
            >
              {theme === 'sombre' ? (
                <Sun className="size-4" aria-hidden />
              ) : (
                <Moon className="size-4" aria-hidden />
              )}
            </Button>

            <LocaleButton />

            <Button
              variant="ghost"
              size="icon"
              aria-label={m.shell_sign_out()}
              onClick={() => signOut.mutate()}
              disabled={signOut.isPending}
            >
              <LogOut className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}

/**
 * The language switch.
 *
 * It shows the CURRENT language, not the one you would switch to - the
 * opposite of the theme button right next to it. The difference is deliberate:
 * a sun says "click for light" without ambiguity, but a button reading "EN"
 * could just as well mean "you are in English" as "switch to English", and the
 * two readings contradict each other. Every interface that offers a language
 * shows the current one, so we do the same, and the target language is in the
 * accessible name and the tooltip.
 *
 * `setLocale` writes the cookie and reloads the document. There is no lighter
 * way: the page was rendered server-side in the old language, and the server
 * has to produce it again - which is also what keeps the two halves in
 * agreement. It costs one reload, for something nobody does twice a service.
 */
function LocaleButton() {
  const locale = getLocale()
  // Two languages, so the button is a toggle. A third one would make this a
  // menu - LOCALE_LABEL is already the list it would be built from.
  const next = locale === 'fr' ? 'en' : 'fr'

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={m.shell_change_language()}
      title={LOCALE_LABEL[next]}
      onClick={() => setLocale(next)}
      className="text-xs font-semibold"
    >
      {locale.toUpperCase()}
    </Button>
  )
}

function ModeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function NavLink({
  to,
  icon,
  children,
}: {
  to: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      activeProps={{ className: 'bg-muted text-foreground' }}
      /**
       * `exact`: by default a link counts as active as soon as the URL STARTS
       * WITH its target. On /bar/historique, "Prise de commande" (/bar) lit up
       * alongside "Historique" and two tabs looked selected. Every entry in this
       * bar points at one page, never a section: the match has to be exact.
       */
      activeOptions={{ exact: true }}
    >
      {icon}
      <span className="hidden sm:inline">{children}</span>
    </Link>
  )
}
