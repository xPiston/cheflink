import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { Badge } from '#/components/ui/badge'
import { Card, CardContent } from '#/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { useAppEvents } from '#/hooks/use-app-events'
import { ORDER_STATUS, type OrderStatus } from '#/lib/orders'
import { listOrderHistory } from '#/server/functions/orders'

export const Route = createFileRoute('/_app/bar/historique')({
  component: HistoryPage,
})

type Filter = 'toutes' | OrderStatus

const STATUS_LABEL: Record<OrderStatus, string> = {
  [ORDER_STATUS.Pending]: 'En attente',
  [ORDER_STATUS.Done]: 'Terminee',
}

const dateTime = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

function HistoryPage() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<Filter>('toutes')

  const orders = useQuery({
    queryKey: ['orders', 'history', filter],
    queryFn: () =>
      listOrderHistory({
        data: { status: filter === 'toutes' ? undefined : filter, limit: 100 },
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
        <h1 className="mr-auto text-2xl font-semibold">Historique</h1>

        <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
          <TabsList>
            <TabsTrigger value="toutes">Toutes</TabsTrigger>
            <TabsTrigger value={ORDER_STATUS.Pending}>En attente</TabsTrigger>
            <TabsTrigger value={ORDER_STATUS.Done}>Terminees</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {orders.isLoading ? <p className="text-sm text-muted-foreground">Chargement...</p> : null}

      {orders.isSuccess && rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            Aucune commande pour ce filtre.
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
                    {STATUS_LABEL[order.status]}
                  </Badge>
                </div>

                <p className="mt-1 text-sm text-muted-foreground">
                  Envoyee a {dateTime.format(new Date(order.createdAt))}
                  {order.completedAt
                    ? ` - prete a ${dateTime.format(new Date(order.completedAt))}`
                    : null}
                </p>

                {order.note ? (
                  <p className="mt-1 text-sm text-muted-foreground">Note : {order.note}</p>
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
