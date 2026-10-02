import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Le schema de l'application.
 *
 * Quatre tables metier, une pour l'authentification. Les identifiants sont des
 * UUID et non des entiers auto-incrementes : une commande est creee cote
 * serveur puis diffusee en SSE a toutes les tablettes, et un identifiant
 * opaque evite de laisser deviner le volume d'activite du bar.
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
  /** Un plat retire de la carte du jour reste commandable demain. */
  available: integer('available', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
})

export const orders = sqliteTable(
  'orders',
  {
    id: text('id').primaryKey(),
    /** "Table 4", "Comptoir"... libre, c'est ce que crie le serveur. */
    tableLabel: text('table_label').notNull(),
    note: text('note'),
    /** 'en_attente' | 'terminee' - voir src/lib/orders.ts. */
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
     * Le plat d'origine, pour les statistiques. Il peut disparaitre : la
     * reference passe alors a null, et la commande reste lisible.
     */
    dishId: text('dish_id').references(() => dishes.id, { onDelete: 'set null' }),
    /**
     * Le nom est COPIE au moment de la commande, pas lu par jointure. Sans ca,
     * renommer un plat reecrirait l'historique - et le supprimer effacerait ce
     * qui a ete servi.
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
