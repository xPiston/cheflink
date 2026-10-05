import { createServerFn } from '@tanstack/react-start'
import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { getDb } from '#/db/client'
import { dishes } from '#/db/schema'
import { m } from '#/paraglide/messages'
import { newId, requireUser } from '#/server/auth'
import { publish } from '#/server/events'

export type Dish = {
  id: string
  name: string
  description: string | null
  category: string
  available: boolean
}

/**
 * The validation messages are functions, not strings.
 *
 * A schema is built once, when the module is first imported; a message has to
 * be read once per request, in the language of whoever sent it. Zod calls these
 * callbacks at parse time - inside the request, where `src/server.ts` has set
 * the locale - so the same schema answers in French to the bar and in English
 * to an English tablet. Written as plain strings they would be frozen in
 * whatever language the server started in.
 */
const dishInput = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: () => m.error_dish_name_required() })
    .max(80),
  description: z.string().trim().max(240).optional().or(z.literal('')),
  category: z
    .string()
    .trim()
    .min(1, { error: () => m.error_dish_category_required() })
    .max(40),
  available: z.boolean(),
})

export const listDishes = createServerFn({ method: 'GET' }).handler(async (): Promise<Dish[]> => {
  await requireUser()

  const rows = await getDb()
    .select()
    .from(dishes)
    .orderBy(asc(dishes.category), asc(dishes.name))

  return rows.map(toDish)
})

export const createDish = createServerFn({ method: 'POST' })
  .validator(dishInput)
  .handler(async ({ data }): Promise<Dish> => {
    await requireUser()

    const [row] = await getDb()
      .insert(dishes)
      .values({
        id: newId(),
        name: data.name,
        description: data.description || null,
        category: data.category,
        available: data.available,
      })
      .returning()

    await publish({ type: 'dishes.changed' })

    return toDish(row)
  })

/**
 * Unlike the rule errors in `src/lib/orders.ts`, this message IS shown: the
 * dishes page puts `error.message` straight into a toast, because "this dish
 * was deleted from another screen a moment ago" is something the user needs to
 * read, not a developer. Hence a real message, resolved at throw time in the
 * caller's language.
 */
export class DishNotFoundError extends Error {
  constructor(readonly dishId: string) {
    super(m.error_dish_not_found())
    this.name = 'DishNotFoundError'
  }
}

export const updateDish = createServerFn({ method: 'POST' })
  .validator(dishInput.extend({ id: z.string().uuid() }))
  .handler(async ({ data }): Promise<Dish> => {
    await requireUser()

    const [row] = await getDb()
      .update(dishes)
      .set({
        name: data.name,
        description: data.description || null,
        category: data.category,
        available: data.available,
      })
      .where(eq(dishes.id, data.id))
      .returning()

    if (!row) {
      throw new DishNotFoundError(data.id)
    }

    await publish({ type: 'dishes.changed' })

    return toDish(row)
  })

/**
 * Removes the dish from the menu.
 *
 * Past orders are unaffected: every line copied the dish name when it was sent,
 * and the reference simply becomes null (see the schema). A dish can therefore
 * be pulled without cutting into history.
 */
export const deleteDish = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    await requireUser()

    const deleted = await getDb().delete(dishes).where(eq(dishes.id, data.id)).returning()
    if (deleted.length === 0) {
      throw new DishNotFoundError(data.id)
    }

    await publish({ type: 'dishes.changed' })

    return { ok: true }
  })

function toDish(row: typeof dishes.$inferSelect): Dish {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    available: row.available,
  }
}
