import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { BellRing, Check, Clock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { useAppEvents } from '#/hooks/use-app-events'
import { useOrderChime } from '#/hooks/use-order-chime'
import { urgency, waitingMinutes } from '#/lib/orders'
import { cn } from '#/lib/utils'
import { completeOrder, listPendingOrders, type OrderView } from '#/server/functions/orders'

export const Route = createFileRoute('/_app/cuisine')({
  component: KitchenPage,
})

const URGENCY_STYLES = {
  calme: 'border-border/60',
  presse: 'border-amber-500/70',
  tres_presse: 'border-destructive/80',
} as const

function KitchenPage() {
  const queryClient = useQueryClient()
  const chime = useOrderChime()
  const [now, setNow] = useState(() => Date.now())

  const orders = useQuery({
    queryKey: ['orders', 'pending'],
    queryFn: () => listPendingOrders(),
    /**
     * Filet de securite, pas le mecanisme principal : les commandes arrivent
     * par SSE. Ce rafraichissement lent rattrape le cas ou le serveur aurait
     * ete coupe assez longtemps pour que la reconnexion elle-meme echoue, sans
     * que personne ne touche la tablette.
     */
    refetchInterval: 60_000,
  })

  /**
   * L'horloge des pastilles d'attente. Elle bat toutes les dix secondes et ne
   * declenche aucune requete : seul l'affichage "il y a N min" change.
   */
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10_000)

    return () => clearInterval(timer)
  }, [])

  useAppEvents({
    onEvent: (event) => {
      if (event.type === 'order.created') {
        chime.play()
        void queryClient.invalidateQueries({ queryKey: ['orders'] })
      }
      if (event.type === 'order.completed') {
        void queryClient.invalidateQueries({ queryKey: ['orders'] })
      }
    },
    // A chaque (re)connexion du flux : on repart de l'etat reel, sans quoi une
    // commande envoyee pendant la coupure resterait invisible.
    onConnect: () => void queryClient.invalidateQueries({ queryKey: ['orders'] }),
  })

  const complete = useMutation({
    mutationFn: (orderId: string) => completeOrder({ data: { id: orderId } }),
    /**
     * Mise a jour optimiste : la carte disparait au doigt, sans attendre le
     * serveur. Sur une tablette en cuisine, un demi-seconde de latence donne
     * l'impression que l'appui n'a pas ete pris, et on tape une deuxieme fois.
     */
    onMutate: async (orderId) => {
      await queryClient.cancelQueries({ queryKey: ['orders', 'pending'] })
      const previous = queryClient.getQueryData<OrderView[]>(['orders', 'pending'])

      queryClient.setQueryData<OrderView[]>(['orders', 'pending'], (current) =>
        (current ?? []).filter((order) => order.id !== orderId)
      )

      return { previous }
    },
    onError: (_error, _orderId, context) => {
      queryClient.setQueryData(['orders', 'pending'], context?.previous)
      toast.error("La commande n'a pas pu etre validee.")
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
  })

  const pending = orders.data ?? []

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl font-semibold">
          En cuisine
          <span className="ml-2 text-base font-normal text-muted-foreground">
            {pending.length} commande(s)
          </span>
        </h1>

        {/*
          Tant que le son n'a pas ete debloque par un vrai appui, on le dit.
          Les navigateurs refusent de jouer quoi que ce soit avant une
          interaction : sans ce bouton, la tablette resterait muette toute la
          soiree sans que personne ne comprenne pourquoi.
        */}
        {chime.enabled ? (
          <Badge variant="secondary" className="gap-1">
            <BellRing className="size-3.5" aria-hidden />
            Son actif
          </Badge>
        ) : (
          <Button
            variant="outline"
            onClick={async () => {
              const ready = await chime.enable()
              if (ready) {
                chime.play()
                toast.success('Son active pour cette tablette.')
              } else {
                toast.error("Ce navigateur refuse l'audio.")
              }
            }}
          >
            <BellRing className="size-4" aria-hidden />
            Activer le son
          </Button>
        )}
      </div>

      {orders.isLoading ? <p className="text-sm text-muted-foreground">Chargement...</p> : null}

      {orders.isSuccess && pending.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            Rien a preparer. Les nouvelles commandes apparaissent ici toutes seules.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {pending.map((order) => {
          const waited = waitingMinutes(new Date(order.createdAt), new Date(now))
          const level = urgency(waited)

          return (
            /**
             * Toute la carte est le bouton : en cuisine on tape avec le dos de
             * la main ou un doigt gras, viser une petite zone est perdu
             * d'avance.
             */
            <button
              key={order.id}
              type="button"
              onClick={() => complete.mutate(order.id)}
              className="text-left"
              aria-label={`Marquer la commande ${order.tableLabel} comme prete`}
            >
              <Card
                className={cn(
                  'h-full border-2 transition-transform active:scale-[0.98]',
                  URGENCY_STYLES[level]
                )}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between gap-2">
                    <span className="truncate text-lg">{order.tableLabel}</span>
                    <Badge
                      variant={level === 'tres_presse' ? 'destructive' : 'secondary'}
                      className="gap-1 shrink-0"
                    >
                      <Clock className="size-3.5" aria-hidden />
                      {waited} min
                    </Badge>
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-3">
                  <ul className="space-y-1">
                    {order.lines.map((line) => (
                      <li key={line.id} className="flex gap-2 text-base">
                        <span className="w-7 shrink-0 font-semibold tabular-nums">
                          {line.quantity}x
                        </span>
                        <span className="min-w-0 flex-1">{line.dishName}</span>
                      </li>
                    ))}
                  </ul>

                  {/*
                    La note porte souvent une allergie : elle doit rester
                    lisible dans les deux themes. Un seul ton d'ambre ne peut
                    pas y suffire - clair sur fond sombre, il devient du jaune
                    pale sur du jaune pale des que le theme passe au clair.
                  */}
                  {order.note ? (
                    <p className="rounded-md bg-amber-500/15 px-3 py-2 text-sm font-medium text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                      {order.note}
                    </p>
                  ) : null}

                  <div className="flex items-center gap-2 pt-1 text-sm text-muted-foreground">
                    <Check className="size-4" aria-hidden />
                    Appuyer pour marquer pret
                  </div>
                </CardContent>
              </Card>
            </button>
          )
        })}
      </div>
    </div>
  )
}
