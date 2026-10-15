import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

/**
 * The application schema.
 *
 * Five business tables, one for authentication. Identifiers are UUIDs rather
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

/**
 * A section of the card - "Plats", "Desserts" - and its colour.
 *
 * A table rather than the free text it used to be on the dish, because the
 * colour belongs to the CATEGORY: recolouring "Desserts" has to move every
 * dessert at once, and with the name copied onto each dish there would be
 * nothing to recolour. The name is unique for the same reason - two rows
 * called "Desserts" in two different colours is the state this table exists
 * to make impossible.
 *
 * The colour is a token, never a hex: see src/lib/categories.ts.
 */
export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  color: text('color').notNull().default('blanc'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
})

export const dishes = sqliteTable(
  'dishes',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    /**
     * Nullable although the application never writes a dish without one.
     *
     * SQLite cannot add a NOT NULL column that points at another table - the
     * added column has to default to NULL - and the only way around it is to
     * rebuild the table, which here would mean dropping `dishes` while
     * `order_items` references it and watching the history lose its dish
     * references on the way through. The guarantee is kept one level up, in
     * the validator: see src/server/functions/dishes.ts.
     */
    categoryId: text('category_id').references(() => categories.id),
    /** A dish pulled from today's menu can be ordered again tomorrow. */
    available: integer('available', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [index('idx_dishes_category').on(table.categoryId)]
)

export const orders = sqliteTable(
  'orders',
  {
    id: text('id').primaryKey(),
    /**
     * What the kitchen calls out: 1, 2, 3... restarted every service.
     *
     * Two columns rather than one, because the number alone is not unique:
     * `service_day` says which service it counts within, and the pair is what
     * the unique index below protects. See `serviceDay()` in src/lib/orders.ts
     * for why a service is not a calendar day.
     *
     * The default of 0 is an artefact of the migration - SQLite will not add a
     * NOT NULL column without one - and nothing in the application ever writes
     * it: the number is computed by the INSERT itself, in
     * src/server/functions/orders.ts.
     */
    number: integer('number').notNull().default(0),
    serviceDay: text('service_day').notNull().default(''),
    note: text('note'),
    /** 'en_attente' | 'terminee' | 'annulee' - see src/lib/orders.ts. */
    status: text('status').notNull(),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
    /**
     * Its own column rather than reusing `completed_at`: an order that was
     * cancelled was never completed, and one field holding either fact would
     * make "how long does the kitchen take" count the orders it never cooked.
     */
    cancelledAt: integer('cancelled_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    index('idx_orders_status_created').on(table.status, table.createdAt),
    index('idx_orders_created').on(table.createdAt),
    /**
     * Not decoration: this index is what makes the numbering safe.
     *
     * The number is produced by `INSERT ... SELECT max(number) + 1`, one
     * statement, so SQLite settles two simultaneous orders itself. The unique
     * index is the proof rather than the mechanism - if a second way of
     * creating an order ever appears and computes the number separately, it
     * fails loudly here instead of quietly handing two tables the same card.
     */
    uniqueIndex('idx_orders_service_day_number').on(table.serviceDay, table.number),
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
export type CategoryRow = typeof categories.$inferSelect
export type DishRow = typeof dishes.$inferSelect
export type OrderRow = typeof orders.$inferSelect
export type OrderItemRow = typeof orderItems.$inferSelect
