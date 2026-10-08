import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { useAppEvents } from '#/hooks/use-app-events'
import { dateTimeFormat } from '#/lib/locale'
import { ORDER_STATUS, type OrderStatus } from '#/lib/orders'
import { m } from '#/paraglide/messages'
import { getLocale } from '#/paraglide/runtime'
import { cancelOrder, listOrderHistory, type OrderView } from '#/server/functions/orders'

export const Route = createFileRoute('/_app/bar/historique')({
  component: HistoryPage,
})

/**
 * `all` is this screen's own sentinel, not a status: it means "do not filter".
 * Unlike the two statuses, which are the values stored in D1, it never leaves
 * the page, so it is spelled in English like the rest of the code.
 */
type Filter = 'all' | OrderStatus

/**
 * The badge labels, as functions: a message is read at call time, from the
 * request's locale. Holding the strings in a constant would freeze them in
 * whichever language the module happened to be imported under.
 */
const STATUS_LABEL: Record<OrderStatus, () => string> = {
  [ORDER_STATUS.Pending]: m.history_status_pending,
  [ORDER_STATUS.Done]: m.history_status_done,
  [ORDER_STATUS.Cancelled]: m.history_status_cancelled,
}

/**
 * The badge's colour. A cancelled order is not a failure to shout about, but
 * it must not read like a served one either - somebody has to notice at a
 * glance that this table got nothing.
 */
const STATUS_VARIANT: Record<OrderStatus, 'default' | 'secondary' | 'outline'> = {
  [ORDER_STATUS.Pending]: 'default',
  [ORDER_STATUS.Done]: 'secondary',
  [ORDER_STATUS.Cancelled]: 'outline',
}

function HistoryPage() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<Filter>('all')
  /**
   * The order the bar is about to take back, or none.
   *
   * Cancelling asks first, unlike every other gesture in this application.
   * Everything else is reversible by doing it again; this one stops a kitchen
   * that may already be cooking, and the screen it happens on is a list of
   * near-identical rows where the wrong line is one thumb away.
   */
  const [cancelling, setCancelling] = useState<OrderView | null>(null)

  /**
   * The formatter follows the language, and the language only changes on a
   * reload, so building it once per page is enough. `Intl.DateTimeFormat` is
   * not free: it is the kind of object you keep rather than rebuild on every
   * row of the list.
   */
  const dateTime = useMemo(() => dateTimeFormat(getLocale()), [])

  const orders = useQuery({
    queryKey: ['orders', 'history', filter],
    queryFn: () =>
      listOrderHistory({
        data: { status: filter === 'all' ? undefined : filter, limit: 100 },
      }),
  })

  // The history updates when the kitchen completes an order: the bar sees it
  // turn to "terminee" without doing anything. Same for a cancellation from
  // another station.
  useAppEvents({
    onEvent: (event) => {
      if (
        event.type === 'order.created' ||
        event.type === 'order.completed' ||
        event.type === 'order.cancelled'
      ) {
        void queryClient.invalidateQueries({ queryKey: ['orders'] })
      }
    },
    onConnect: () => void queryClient.invalidateQueries({ queryKey: ['orders'] }),
  })

  const cancel = useMutation({
    mutationFn: (orderId: string) => cancelOrder({ data: { id: orderId } }),
    onSuccess: (order) => {
      setCancelling(null)
      toast.success(m.history_cancel_done({ table: order.tableLabel }))
    },
    // No optimistic update here, deliberately. The row is not disappearing
    // under the finger - it stays, with a different badge - and the one thing
    // that must not happen is the bar believing the kitchen was stopped when
    // the write never landed.
    onError: () => toast.error(m.history_cancel_failed()),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
  })

  const rows = orders.data ?? []

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="mr-auto text-2xl font-semibold">{m.nav_history()}</h1>

        <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
          <TabsList>
            <TabsTrigger value="all">{m.history_filter_all()}</TabsTrigger>
            <TabsTrigger value={ORDER_STATUS.Pending}>{m.history_filter_pending()}</TabsTrigger>
            <TabsTrigger value={ORDER_STATUS.Done}>{m.history_filter_done()}</TabsTrigger>
            <TabsTrigger value={ORDER_STATUS.Cancelled}>
              {m.history_filter_cancelled()}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {orders.isLoading ? <p className="text-sm text-muted-foreground">{m.common_loading()}</p> : null}

      {orders.isSuccess && rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            {m.history_empty()}
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-3">
        {rows.map((order) => (
          <Card key={order.id}>
            <CardContent className="flex flex-wrap items-start gap-4 py-4">
              <div className="min-w-40 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{order.tableLabel}</span>
                  <Badge variant={STATUS_VARIANT[order.status]}>
                    {STATUS_LABEL[order.status]()}
                  </Badge>
                </div>

                <p className="mt-1 text-sm text-muted-foreground">
                  {m.history_sent_at({ time: dateTime.format(new Date(order.createdAt)) })}
                  {order.completedAt
                    ? ` - ${m.history_ready_at({ time: dateTime.format(new Date(order.completedAt)) })}`
                    : null}
                  {order.cancelledAt
                    ? ` - ${m.history_cancelled_at({ time: dateTime.format(new Date(order.cancelledAt)) })}`
                    : null}
                </p>

                {order.note ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {m.history_note({ note: order.note })}
                  </p>
                ) : null}
              </div>

              <ul className="min-w-48 flex-1 space-y-0.5 text-sm">
                {order.lines.map((line) => (
                  <li key={line.id} className="flex gap-2">
                    <span className="w-6 shrink-0 tabular-nums text-muted-foreground">
                      {line.quantity}x
                    </span>
                    <span className="min-w-0 flex-1 truncate">{line.dishName}</span>
                  </li>
                ))}
              </ul>

              {/*
                Only while it is still waiting. A served order has a plate
                behind it, and the button would offer to undo something that
                cannot be undone.
              */}
              {order.status === ORDER_STATUS.Pending ? (
                <Button
                  variant="outline"
                  className="shrink-0"
                  onClick={() => setCancelling(order)}
                  aria-label={m.history_cancel_order({ table: order.tableLabel })}
                >
                  <X className="size-4" aria-hidden />
                  {m.history_cancel()}
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={cancelling !== null} onOpenChange={(open) => !open && setCancelling(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m.history_cancel_title({ table: cancelling?.tableLabel ?? '' })}</DialogTitle>
            <DialogDescription>{m.history_cancel_warning()}</DialogDescription>
          </DialogHeader>

          <ul className="space-y-0.5 text-sm">
            {(cancelling?.lines ?? []).map((line) => (
              <li key={line.id} className="flex gap-2">
                <span className="w-6 shrink-0 tabular-nums text-muted-foreground">
                  {line.quantity}x
                </span>
                <span className="min-w-0 flex-1">{line.dishName}</span>
              </li>
            ))}
          </ul>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelling(null)}>
              {m.history_cancel_keep()}
            </Button>
            <Button
              variant="destructive"
              disabled={cancel.isPending}
              onClick={() => cancelling && cancel.mutate(cancelling.id)}
            >
              {cancel.isPending ? m.history_cancel_pending() : m.history_cancel_confirm()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
