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
import { ChefHat, ClipboardList, History, LogOut, UtensilsCrossed, Wine } from 'lucide-react'
import { useEffect } from 'react'

import { Button } from '#/components/ui/button'
import { useMode, type Mode } from '#/lib/mode'
import { cn } from '#/lib/utils'
import { logout } from '#/server/functions/auth'

/**
 * La coquille des pages authentifiees.
 *
 * Route "pathless" (le `_` du nom) : elle n'ajoute rien a l'URL, elle apporte
 * seulement l'en-tete commun et la garde d'acces. Tout ce qui est en dessous
 * est protege par construction - on ne peut pas oublier de proteger une page,
 * il suffit de la mettre au bon endroit.
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
  const navigate = useNavigate()
  const router = useRouter()
  const { pathname } = useLocation()

  /**
   * L'URL fait foi sur le mode affiche.
   *
   * Sans ca, ouvrir /cuisine depuis un favori ou un lien laisse l'en-tete sur
   * "Bar" avec la navigation du bar, pendant que l'ecran montre la cuisine - on
   * croit que le selecteur est casse. `/plats` ne touche a rien : il sert aux
   * deux modes.
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
   * Changer de mode emmene sur l'ecran correspondant. Sans ca, basculer en
   * "cuisine" depuis l'historique du bar ne ferait rien de visible, et on
   * croirait que le bouton est casse.
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

          {/* Le selecteur de mode : des cibles larges, la tablette se tape au doigt. */}
          <div
            className="flex items-center rounded-lg border border-border/60 p-1"
            role="group"
            aria-label="Mode de l'appareil"
          >
            <ModeButton
              active={mode === 'bar'}
              onClick={() => switchMode('bar')}
              icon={<Wine className="size-4" aria-hidden />}
              label="Bar"
            />
            <ModeButton
              active={mode === 'cuisine'}
              onClick={() => switchMode('cuisine')}
              icon={<ChefHat className="size-4" aria-hidden />}
              label="Cuisine"
            />
          </div>

          <nav className="flex items-center gap-1">
            {mode === 'bar' ? (
              <>
                <NavLink to="/bar" icon={<ClipboardList className="size-4" aria-hidden />}>
                  Prise de commande
                </NavLink>
                <NavLink to="/bar/historique" icon={<History className="size-4" aria-hidden />}>
                  Historique
                </NavLink>
                <NavLink to="/plats" icon={<UtensilsCrossed className="size-4" aria-hidden />}>
                  Plats
                </NavLink>
              </>
            ) : (
              <NavLink to="/cuisine" icon={<ChefHat className="size-4" aria-hidden />}>
                Commandes
              </NavLink>
            )}
          </nav>

          <div className="flex items-center gap-2 border-l border-border/60 pl-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.name}</span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Se deconnecter"
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
       * `exact` : par defaut, un lien est considere actif des que l'URL COMMENCE
       * par sa cible. Sur /bar/historique, "Prise de commande" (/bar) s'allumait
       * donc en meme temps que "Historique", et deux onglets paraissaient
       * selectionnes. Chaque entree de cette barre designe une page precise,
       * jamais une section : la correspondance doit etre exacte.
       */
      activeOptions={{ exact: true }}
    >
      {icon}
      <span className="hidden sm:inline">{children}</span>
    </Link>
  )
}
