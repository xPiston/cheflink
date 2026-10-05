import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * The application schema.
 *
 * Four business tables, one for authentication. Identifiers are UUIDs rather
 * than auto-incrementing integers: an order is created server-side then
 * broadcast to every tablet, and an opaque id avoids leaking how busy the bar
 * is.
 */

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
})

export const sessions = sqliteTable(
  'sessions',
  {
    token: text('token').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('idx_sessions_user').on(table.userId)]
)

export const dishes = sqliteTable('dishes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category').notNull(),
  /** A dish pulled from today's menu can be ordered again tomorrow. */
  available: integer('available', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
})

export const orders = sqliteTable(
  'orders',
  {
    id: text('id').primaryKey(),
    /** "Table 4", "Comptoir"... free text: it is what the server shouts. */
    tableLabel: text('table_label').notNull(),
    note: text('note'),
    /** 'en_attente' | 'terminee' - see src/lib/orders.ts. */
    status: text('status').notNull(),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    index('idx_orders_status_created').on(table.status, table.createdAt),
    index('idx_orders_created').on(table.createdAt),
  ]
)

export const orderItems = sqliteTable(
  'order_items',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    /**
     * The dish it came from, for statistics. It may disappear: the reference
     * then becomes null and the order stays readable.
     */
    dishId: text('dish_id').references(() => dishes.id, { onDelete: 'set null' }),
    /**
     * The name is COPIED when the order is placed, not read through a join.
     * Without that, renaming a dish would rewrite history - and deleting one
     * would erase what was actually served.
     */
    dishName: text('dish_name').notNull(),
    quantity: integer('quantity').notNull(),
  },
  (table) => [index('idx_order_items_order').on(table.orderId)]
)

export type UserRow = typeof users.$inferSelect
export type DishRow = typeof dishes.$inferSelect
export type OrderRow = typeof orders.$inferSelect
export type OrderItemRow = typeof orderItems.$inferSelect
