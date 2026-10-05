import { createServerFn } from '@tanstack/react-start'
import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { getDb } from '#/db/client'
import { dishes } from '#/db/schema'
import { newId, requireUser } from '#/server/auth'
import { publish } from '#/server/events'

export type Dish = {
  id: string
  name: string
  description: string | null
  category: string
  available: boolean
}

const dishInput = z.object({
  name: z.string().trim().min(1, 'Le nom est obligatoire.').max(80),
  description: z.string().trim().max(240).optional().or(z.literal('')),
  category: z.string().trim().min(1, 'La categorie est obligatoire.').max(40),
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

export class DishNotFoundError extends Error {
  constructor(readonly dishId: string) {
    super('Ce plat n existe plus.')
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
