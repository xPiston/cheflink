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
     * A safety net, not the main mechanism: orders arrive over the real-time
     * stream. This slow refetch covers the case where the server was down long
     * enough for the reconnect itself to fail, with nobody touching the tablet.
     */
    refetchInterval: 60_000,
  })

  /**
   * The clock behind the waiting badges. It ticks every ten seconds and fires
   * no request: only the "N min" display changes.
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
    // On every (re)connection of the stream: start again from the real state,
    // otherwise an order sent during the outage would stay invisible.
    onConnect: () => void queryClient.invalidateQueries({ queryKey: ['orders'] }),
  })

  const complete = useMutation({
    mutationFn: (orderId: string) => completeOrder({ data: { id: orderId } }),
    /**
     * Optimistic update: the card disappears under the finger, without waiting
     * for the server. On a kitchen tablet, half a second of latency feels like
     * the tap was not registered, and you tap a second time.
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
          While the sound has not been unlocked by a real tap, we say so.
          Browsers refuse to play anything before an interaction: without this
          button the tablet would stay mute all evening with nobody
          understanding why.
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
             * The whole card is the button: in a kitchen you tap with the back
             * of your hand or a greasy finger, and aiming at a small target is
             * a lost cause.
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
                    The note often carries an allergy: it has to stay legible in
                    both themes. A single shade of amber cannot do that - light
                    on a dark background, it turns into pale yellow on pale
                    yellow as soon as the theme goes light.
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
