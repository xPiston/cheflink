import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import { Badge } from '#/components/ui/badge'
import { Card, CardContent } from '#/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { useAppEvents } from '#/hooks/use-app-events'
import { dateTimeFormat } from '#/lib/locale'
import { ORDER_STATUS, type OrderStatus } from '#/lib/orders'
import { m } from '#/paraglide/messages'
import { getLocale } from '#/paraglide/runtime'
import { listOrderHistory } from '#/server/functions/orders'

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
}

function HistoryPage() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<Filter>('all')

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
  // turn to "terminee" without doing anything.
  useAppEvents({
    onEvent: (event) => {
      if (event.type === 'order.created' || event.type === 'order.completed') {
        void queryClient.invalidateQueries({ queryKey: ['orders'] })
      }
    },
    onConnect: () => void queryClient.invalidateQueries({ queryKey: ['orders'] }),
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
                  <Badge
                    variant={order.status === ORDER_STATUS.Done ? 'secondary' : 'default'}
                  >
                    {STATUS_LABEL[order.status]()}
                  </Badge>
                </div>

                <p className="mt-1 text-sm text-muted-foreground">
                  {m.history_sent_at({ time: dateTime.format(new Date(order.createdAt)) })}
                  {order.completedAt
                    ? ` - ${m.history_ready_at({ time: dateTime.format(new Date(order.completedAt)) })}`
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
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
