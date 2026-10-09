import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq, gte, inArray, type SQL } from 'drizzle-orm'
import { z } from 'zod'

import { getDb } from '#/db/client'
import { dishes, orderItems, orders } from '#/db/schema'
import {
  DEFAULT_HISTORY_PERIOD,
  HISTORY_PERIODS,
  ORDER_STATUS,
  UnavailableDishError,
  canTransition,
  isOrderStatus,
  mergeLines,
  periodStart,
  type OrderStatus,
} from '#/lib/orders'
import { m } from '#/paraglide/messages'
import { newId, requireUser } from '#/server/auth'
import { publish } from '#/server/events'

export type OrderLineView = {
  id: string
  dishName: string
  quantity: number
}

export type OrderView = {
  id: string
  tableLabel: string
  note: string | null
  status: OrderStatus
  createdAt: number
  completedAt: number | null
  cancelledAt: number | null
  lines: OrderLineView[]
}

/**
 * The validation messages are functions, not strings: Zod calls them at parse
 * time, inside the request, so the same schema answers in the language of
 * whoever sent the order. See the note in `dishes.ts`.
 */
const createOrderInput = z.object({
  tableLabel: z
    .string()
    .trim()
    .min(1, { error: () => m.error_table_required() })
    .max(40),
  note: z.string().trim().max(240).optional().or(z.literal('')),
  lines: z
    .array(z.object({ dishId: z.string().uuid(), quantity: z.number().int().min(1).max(99) }))
    .min(1, { error: () => m.error_at_least_one_dish() }),
})

/**
 * Sends an order to the kitchen.
 *
 * Two things that matter:
 *   - the dish name is read from the database HERE, never taken from the
 *     browser. The client only sends ids and quantities, so nothing displayed
 *     in the kitchen comes from it;
 *   - everything happens in ONE atomic write. A half-written order would show
 *     up in the kitchen with half its dishes.
 */
export const createOrder = createServerFn({ method: 'POST' })
  .validator(createOrderInput)
  .handler(async ({ data }): Promise<OrderView> => {
    const user = await requireUser()

    const db = getDb()
    const merged = mergeLines(data.lines)
    const rows = await db
      .select()
      .from(dishes)
      .where(
        inArray(
          dishes.id,
          merged.map((line) => line.dishId)
        )
      )

    const byId = new Map(rows.map((row) => [row.id, row]))
    const orderId = newId()
    const now = new Date()

    const lines = merged.map((line) => {
      const dish = byId.get(line.dishId)
      if (!dish) {
        throw new UnavailableDishError(line.dishId)
      }
      if (!dish.available) {
        throw new UnavailableDishError(dish.name)
      }

      return {
        id: newId(),
        orderId,
        dishId: dish.id,
        dishName: dish.name,
        quantity: line.quantity,
      }
    })

    /**
     * `batch` rather than a transaction: D1 exposes no BEGIN/COMMIT to the
     * client, but guarantees a batch applies entirely or not at all. That is
     * exactly what is needed here - a half-written order would show up in the
     * kitchen with half its dishes.
     */
    await db.batch([
      db.insert(orders).values({
        id: orderId,
        tableLabel: data.tableLabel,
        note: data.note || null,
        status: ORDER_STATUS.Pending,
        createdBy: user.id,
        createdAt: now,
      }),
      db.insert(orderItems).values(lines),
    ])

    await publish({ type: 'order.created', orderId })

    return {
      id: orderId,
      tableLabel: data.tableLabel,
      note: data.note || null,
      status: ORDER_STATUS.Pending,
      createdAt: now.getTime(),
      completedAt: null,
      cancelledAt: null,
      lines: lines.map(({ id, dishName, quantity }) => ({ id, dishName, quantity })),
    }
  })

/** Pending orders, oldest first: this is the kitchen screen. */
export const listPendingOrders = createServerFn({ method: 'GET' }).handler(
  async (): Promise<OrderView[]> => {
    await requireUser()

    return loadOrders(eq(orders.status, ORDER_STATUS.Pending), 'asc')
  }
)

/**
 * How many orders the history will return, whatever the window.
 *
 * The screen paginates what it is given, so this is the real ceiling. A busy
 * bar over thirty days goes well past it - hence `truncated` below, because a
 * list that silently stops is worse than one that says where it stopped.
 */
export const HISTORY_LIMIT = 500

const historyInput = z.object({
  status: z.enum([ORDER_STATUS.Pending, ORDER_STATUS.Done, ORDER_STATUS.Cancelled]).optional(),
  period: z.enum(Object.keys(HISTORY_PERIODS) as [string, ...string[]]).default(DEFAULT_HISTORY_PERIOD),
})

export type OrderHistory = {
  orders: OrderView[]
  /** Whether the window holds more than was returned. */
  truncated: boolean
}

/**
 * The bar's history: most recent first, within a window, filterable by status.
 *
 * The window is a `WHERE`, not a slice taken in the browser. Thirty days of a
 * busy service is thousands of rows, and the one thing a tablet on bar wifi
 * must not do is download them to show fifty.
 */
export const listOrderHistory = createServerFn({ method: 'GET' })
  .validator(historyInput)
  .handler(async ({ data }): Promise<OrderHistory> => {
    await requireUser()

    const period = data.period as keyof typeof HISTORY_PERIODS
    const filters: SQL[] = [gte(orders.createdAt, periodStart(period, new Date()))]

    if (data.status) {
      filters.push(eq(orders.status, data.status))
    }

    // One row over the ceiling: asking for 501 is how we know 500 was not the
    // whole truth, without a second COUNT query.
    const rows = await loadOrders(and(...filters), 'desc', HISTORY_LIMIT + 1)

    return {
      orders: rows.slice(0, HISTORY_LIMIT),
      truncated: rows.length > HISTORY_LIMIT,
    }
  })

export class OrderNotFoundError extends Error {
  constructor(readonly orderId: string) {
    super(m.error_order_not_found())
    this.name = 'OrderNotFoundError'
  }
}

/**
 * The kitchen taps a card: the order becomes "terminee".
 *
 * `and(id, status = en_attente)` in the WHERE makes this safe under
 * concurrency: if two tablets tap at the same moment, the second updates
 * nothing and returns the already-completed order with no error shown. During
 * service, two people touching the same card is not an incident.
 */
export const completeOrder = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }): Promise<OrderView> => {
    await requireUser()

    const db = getDb()
    const [existing] = await db.select().from(orders).where(eq(orders.id, data.id)).limit(1)
    if (!existing) {
      throw new OrderNotFoundError(data.id)
    }

    const status = isOrderStatus(existing.status) ? existing.status : ORDER_STATUS.Pending
    if (canTransition(status, ORDER_STATUS.Done)) {
      await db
        .update(orders)
        .set({ status: ORDER_STATUS.Done, completedAt: new Date() })
        .where(and(eq(orders.id, data.id), eq(orders.status, ORDER_STATUS.Pending)))

      await publish({ type: 'order.completed', orderId: data.id })
    }

    const [view] = await loadOrders(eq(orders.id, data.id), 'desc')
    if (!view) {
      throw new OrderNotFoundError(data.id)
    }

    return view
  })

/**
 * The bar takes an order back: it becomes "annulee".
 *
 * Only from `en_attente`, and the state machine is what says so. A finished
 * order has been cooked - there is a plate, and marking it cancelled would
 * make it disappear from the only screen that knows about it.
 *
 * Same `and(id, status = en_attente)` guard as completing, for the same
 * reason: during service the bar cancels while the kitchen taps ready, and
 * whichever write lands first wins. The other one changes nothing and returns
 * the order as it now is, rather than failing in somebody's face mid-rush.
 */
export const cancelOrder = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }): Promise<OrderView> => {
    await requireUser()

    const db = getDb()
    const [existing] = await db.select().from(orders).where(eq(orders.id, data.id)).limit(1)
    if (!existing) {
      throw new OrderNotFoundError(data.id)
    }

    const status = isOrderStatus(existing.status) ? existing.status : ORDER_STATUS.Pending
    if (canTransition(status, ORDER_STATUS.Cancelled)) {
      await db
        .update(orders)
        .set({ status: ORDER_STATUS.Cancelled, cancelledAt: new Date() })
        .where(and(eq(orders.id, data.id), eq(orders.status, ORDER_STATUS.Pending)))

      // The kitchen is the screen that must not keep cooking: the card has to
      // go now, not on the next safety refetch.
      await publish({ type: 'order.cancelled', orderId: data.id })
    }

    const [view] = await loadOrders(eq(orders.id, data.id), 'desc')
    if (!view) {
      throw new OrderNotFoundError(data.id)
    }

    return view
  })

async function loadOrders(
  where: SQL | undefined,
  direction: 'asc' | 'desc',
  limit = 200
): Promise<OrderView[]> {
  const db = getDb()
  const base = db.select().from(orders).$dynamic()
  const filtered = where ? base.where(where) : base
  const rows = await filtered
    .orderBy(direction === 'asc' ? orders.createdAt : desc(orders.createdAt))
    .limit(limit)

  if (rows.length === 0) {
    return []
  }

  // One query for all the lines, not one per order: the kitchen screen
  // refetches on every event, and an N+1 would show there quickly.
  const items = await db
    .select()
    .from(orderItems)
    .where(
      inArray(
        orderItems.orderId,
        rows.map((row) => row.id)
      )
    )

  const byOrder = new Map<string, OrderLineView[]>()
  for (const item of items) {
    const list = byOrder.get(item.orderId) ?? []
    list.push({ id: item.id, dishName: item.dishName, quantity: item.quantity })
    byOrder.set(item.orderId, list)
  }

  return rows.map((row) => {
    const lines = byOrder.get(row.id) ?? []

    return {
      id: row.id,
      tableLabel: row.tableLabel,
      note: row.note,
      status: isOrderStatus(row.status) ? row.status : ORDER_STATUS.Pending,
      createdAt: row.createdAt.getTime(),
      completedAt: row.completedAt?.getTime() ?? null,
      cancelledAt: row.cancelledAt?.getTime() ?? null,
      lines,
    }
  })
}
