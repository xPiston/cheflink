import {
  columnFilteringFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  flexRender,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_text,
  tableFeatures,
  useTable,
  type ColumnDef,
} from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, ChevronsUpDown, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { useAppEvents } from '#/hooks/use-app-events'
import { dateTimeFormat } from '#/lib/locale'
import {
  DEFAULT_HISTORY_PERIOD,
  ORDER_STATUS,
  waitingMinutes,
  type HistoryPeriod,
  type OrderStatus,
} from '#/lib/orders'
import { m } from '#/paraglide/messages'
import { getLocale } from '#/paraglide/runtime'
import { cancelOrder, listOrderHistory, type OrderView } from '#/server/functions/orders'

export const Route = createFileRoute('/_app/bar/historique')({
  component: HistoryPage,
})

/**
 * `all` is this screen's own sentinel, not a status: it means "do not filter".
 * Unlike the three statuses, which are the values stored in D1, it never
 * leaves the page, so it is spelled in English like the rest of the code.
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

const PERIOD_LABEL: Record<HistoryPeriod, () => string> = {
  '1d': m.history_period_1d,
  '7d': m.history_period_7d,
  '30d': m.history_period_30d,
}

/**
 * What the table can do, and what it costs.
 *
 * In TanStack Table v9 a feature and its row model are both listed here, and
 * a feature without its `create*RowModel` silently does nothing: the arrows
 * appear, the state changes, the rows come back in the order they arrived.
 * Only the three this screen uses are registered, so nothing else is shipped
 * to a tablet.
 */
const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  rowPaginationFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text },
  filterFns: { includesString: filterFn_includesString },
})

/** A page of a tablet's screen, not of a desktop report. */
const PAGE_SIZE = 12

function HistoryPage() {
  const queryClient = useQueryClient()
  const [period, setPeriod] = useState<HistoryPeriod>(DEFAULT_HISTORY_PERIOD)
  const [filter, setFilter] = useState<Filter>('all')
  /**
   * The order the bar is about to take back, or none.
   *
   * Cancelling asks first, unlike every other gesture in this application.
   * Everything else is reversible by doing it again; this one stops a kitchen
   * that may already be cooking, and a table of near-identical rows is
   * exactly where the wrong one is a thumb away.
   */
  const [cancelling, setCancelling] = useState<OrderView | null>(null)

  /**
   * The formatter follows the language, and the language only changes on a
   * reload, so building it once per page is enough. `Intl.DateTimeFormat` is
   * not free: it is the kind of object you keep rather than rebuild on every
   * row of the list.
   */
  const dateTime = useMemo(() => dateTimeFormat(getLocale()), [])

  const history = useQuery({
    queryKey: ['orders', 'history', period, filter],
    queryFn: () =>
      listOrderHistory({
        data: { status: filter === 'all' ? undefined : filter, period },
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

  const rows = history.data?.orders ?? []

  const columns = useMemo<ColumnDef<typeof features, OrderView>[]>(
    () => [
      {
        accessorKey: 'tableLabel',
        header: m.history_col_table(),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-medium">{row.original.tableLabel}</p>
            {/*
              The note often carries an allergy. It stays on the row rather
              than behind a click: a history is also how you check what was
              asked for when a customer comes back about it.
            */}
            {row.original.note ? (
              // Prefixed rather than bare: a loose line under a table name
              // could be anything, and this one is often an allergy.
              <p className="text-xs text-muted-foreground">
                {m.history_note({ note: row.original.note })}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'dishes',
        /*
         * An accessor, not a display column, even though the cell ignores it.
         * In v9 both sorting and the search box are gated on
         * `column.accessorFn`: without one the dishes are invisible to the
         * search, which is half of what the box offers to look for.
         */
        accessorFn: (order: OrderView) =>
          order.lines.map((line) => `${line.quantity}x ${line.dishName}`).join(', '),
        header: m.history_col_dishes(),
        // Not sortable: "what was on it" has no order anybody wants a
        // service listed in.
        enableSorting: false,
        cell: ({ row }) => (
          <ul className="space-y-0.5">
            {row.original.lines.map((line) => (
              <li key={line.id} className="flex gap-2">
                <span className="w-6 shrink-0 tabular-nums text-muted-foreground">
                  {line.quantity}x
                </span>
                <span className="min-w-0 flex-1">{line.dishName}</span>
              </li>
            ))}
          </ul>
        ),
      },
      {
        id: 'status',
        /*
         * The translated label, not the stored handle: somebody searching
         * "annulée" means the word on the screen, and `annulee` is a value in
         * D1 that nobody types.
         */
        accessorFn: (order: OrderView) => STATUS_LABEL[order.status](),
        header: m.history_col_status(),
        cell: ({ row }) => (
          <Badge variant={STATUS_VARIANT[row.original.status]}>
            {STATUS_LABEL[row.original.status]()}
          </Badge>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: m.history_col_sent(),
        // A timestamp is a fourteen-digit number: left in the search, typing
        // "7" would match most of the service.
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums">
            {dateTime.format(new Date(row.original.createdAt))}
          </span>
        ),
      },
      {
        id: 'closedAt',
        accessorFn: (order: OrderView) => order.completedAt ?? order.cancelledAt,
        header: m.history_col_closed(),
        enableGlobalFilter: false,
        /*
         * Sorted on the timestamp, not on what the cell prints. And an order
         * still waiting sorts last rather than first: on this screen the
         * question is what happened, and "nothing yet" is not the earliest
         * thing that happened.
         */
        sortFn: (a, b) => closedAt(a.original) - closedAt(b.original),
        cell: ({ row }) => {
          const at = row.original.completedAt ?? row.original.cancelledAt

          return at ? (
            <span className="whitespace-nowrap tabular-nums">{dateTime.format(new Date(at))}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )
        },
      },
      {
        id: 'duration',
        accessorFn: (order: OrderView) => cookedMinutes(order),
        header: m.history_col_duration(),
        enableGlobalFilter: false,
        /*
         * How long the kitchen took. Only for an order it actually cooked: a
         * cancelled one has a duration too, and counting it would drag the
         * average towards how fast the bar changes its mind.
         */
        sortFn: (a, b) => (cookedMinutes(a.original) ?? -1) - (cookedMinutes(b.original) ?? -1),
        cell: ({ row }) => {
          const minutes = cookedMinutes(row.original)

          return minutes === null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span className="whitespace-nowrap tabular-nums">
              {m.history_duration_minutes({ minutes })}
            </span>
          )
        },
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) =>
          // Only while it is still waiting. A served order has a plate behind
          // it, and the button would offer to undo something that cannot be.
          row.original.status === ORDER_STATUS.Pending ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCancelling(row.original)}
              aria-label={m.history_cancel_order({ table: row.original.tableLabel })}
            >
              <X className="size-4" aria-hidden />
              {m.history_cancel()}
            </Button>
          ) : null,
      },
    ],
    [dateTime]
  )

  const table = useTable({
    features,
    data: rows,
    columns,
    initialState: {
      pagination: { pageIndex: 0, pageSize: PAGE_SIZE },
      // Newest first, which is the order a history is read in.
      sorting: [{ id: 'createdAt', desc: true }],
    },
  })

  const pages = table.getPageCount()
  const matched = table.getFilteredRowModel().rows.length

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="mr-auto text-2xl font-semibold">{m.nav_history()}</h1>

        <Tabs value={period} onValueChange={(value) => setPeriod(value as HistoryPeriod)}>
          <TabsList>
            {(Object.keys(PERIOD_LABEL) as HistoryPeriod[]).map((key) => (
              <TabsTrigger key={key} value={key}>
                {PERIOD_LABEL[key]()}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

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

      <div className="relative max-w-sm">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          aria-label={m.history_search()}
          placeholder={m.history_search()}
          className="pl-8"
          value={table.state.globalFilter ?? ''}
          onChange={(event) => table.setGlobalFilter(event.target.value)}
        />
      </div>

      {/*
        Said rather than hidden: a window that holds more than the server will
        return has to admit it, or a missing order reads as an order that was
        never taken.
      */}
      {history.data?.truncated ? (
        <p className="text-sm text-muted-foreground">{m.history_truncated({ count: rows.length })}</p>
      ) : null}

      {history.isLoading ? (
        <p className="text-sm text-muted-foreground">{m.common_loading()}</p>
      ) : null}

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => {
                  const sortable = header.column.getCanSort()
                  const direction = header.column.getIsSorted()

                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : sortable ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="-ml-3 h-8"
                          onClick={() => header.column.toggleSorting(direction === 'asc')}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {direction === 'asc' ? (
                            <ArrowUp className="size-3.5" aria-hidden />
                          ) : direction === 'desc' ? (
                            <ArrowDown className="size-3.5" aria-hidden />
                          ) : (
                            <ChevronsUpDown className="size-3.5 opacity-50" aria-hidden />
                          )}
                        </Button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {/*
                    An empty window and an empty search are not the same
                    thing: told "no order in this window" with a word still in
                    the box, you would widen the window and still find nothing.
                  */}
                  {table.state.globalFilter ? m.history_no_match() : m.history_empty()}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id} className="align-top">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/*
        Hidden on a single page: controls that can only say "1 of 1" are
        furniture on a screen this size.
      */}
      {pages > 1 ? (
        <div className="flex items-center justify-end gap-2">
          <span className="mr-auto text-sm text-muted-foreground">
            {m.history_order_count({ count: matched })}
          </span>
          <span className="text-sm text-muted-foreground tabular-nums">
            {m.history_page_of({ page: table.state.pagination.pageIndex + 1, pages })}
          </span>
          <Button
            variant="outline"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            {m.history_previous()}
          </Button>
          <Button
            variant="outline"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            {m.history_next()}
          </Button>
        </div>
      ) : null}

      <Dialog open={cancelling !== null} onOpenChange={(open) => !open && setCancelling(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {m.history_cancel_title({ table: cancelling?.tableLabel ?? '' })}
            </DialogTitle>
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

/** When an order left `en_attente`, either way. Still waiting sorts last. */
function closedAt(order: OrderView): number {
  return order.completedAt ?? order.cancelledAt ?? Number.POSITIVE_INFINITY
}

/** How long the kitchen took, or null for an order it never cooked. */
function cookedMinutes(order: OrderView): number | null {
  return order.completedAt === null
    ? null
    : waitingMinutes(new Date(order.createdAt), new Date(order.completedAt))
}

export default HistoryPage
