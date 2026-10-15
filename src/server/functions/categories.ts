import { createServerFn } from '@tanstack/react-start'
import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { getDb } from '#/db/client'
import { categories, dishes } from '#/db/schema'
import { m } from '#/paraglide/messages'
import { newId, requireUser } from '#/server/auth'
import { publish } from '#/server/events'

export type Category = {
  id: string
  name: string
}

/**
 * A category has no colour of its own: the colour is on the dish, so that two
 * dishes of the same section can be told apart on sight. The `color` column
 * still exists on this table and is on its way out - see src/db/schema.ts.
 */

/**
 * The validation messages are functions, not strings: Zod calls them at parse
 * time, in the language of whoever sent the request. See the long note in
 * `dishes.ts`.
 */
const categoryInput = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: () => m.error_category_name_required() })
    .max(40),
})

export class CategoryNotFoundError extends Error {
  constructor(readonly categoryId: string) {
    super(m.error_category_not_found())
    this.name = 'CategoryNotFoundError'
  }
}

export class CategoryNameTakenError extends Error {
  constructor(readonly name: string) {
    super(m.error_category_name_taken())
    this.name = 'CategoryNameTakenError'
  }
}

/**
 * Deleting a category that still holds dishes is refused rather than cascaded.
 *
 * The other way round, those dishes would quietly leave the card: the bar
 * screen groups by category and a dish with none would show up nowhere, which
 * is a dish that cannot be ordered and nobody deleted.
 */
export class CategoryInUseError extends Error {
  constructor(readonly dishCount: number) {
    super(m.error_category_in_use())
    this.name = 'CategoryInUseError'
  }
}

export const listCategories = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Category[]> => {
    await requireUser()

    const rows = await getDb().select().from(categories).orderBy(asc(categories.name))

    return rows.map(toCategory)
  }
)

export const createCategory = createServerFn({ method: 'POST' })
  .validator(categoryInput)
  .handler(async ({ data }): Promise<Category> => {
    await requireUser()

    const db = getDb()
    await refuseDuplicateName(data.name, null)

    const [row] = await db
      .insert(categories)
      .values({ id: newId(), name: data.name })
      .returning()

    // The same event as a dish changing: for every screen that is open, a
    // category appearing and a dish appearing are the same news - the card is
    // not what it was a second ago.
    await publish({ type: 'dishes.changed' })

    return toCategory(row)
  })

export const updateCategory = createServerFn({ method: 'POST' })
  .validator(categoryInput.extend({ id: z.string().uuid() }))
  .handler(async ({ data }): Promise<Category> => {
    await requireUser()

    await refuseDuplicateName(data.name, data.id)

    const [row] = await getDb()
      .update(categories)
      .set({ name: data.name })
      .where(eq(categories.id, data.id))
      .returning()

    if (!row) {
      throw new CategoryNotFoundError(data.id)
    }

    await publish({ type: 'dishes.changed' })

    return toCategory(row)
  })

export const deleteCategory = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    await requireUser()

    const db = getDb()
    const held = await db.select({ id: dishes.id }).from(dishes).where(eq(dishes.categoryId, data.id))

    if (held.length > 0) {
      throw new CategoryInUseError(held.length)
    }

    const deleted = await db.delete(categories).where(eq(categories.id, data.id)).returning()
    if (deleted.length === 0) {
      throw new CategoryNotFoundError(data.id)
    }

    await publish({ type: 'dishes.changed' })

    return { ok: true }
  })

/**
 * The name is unique in the database too - this is for the message.
 *
 * A unique index answers with a constraint violation, which reaches the
 * screen as "something went wrong". The bar needs to read "there is already a
 * Desserts", so the case is checked here, knowing full well that two people
 * creating the same category in the same instant get past it. The index is
 * what makes that harmless; this is what makes the ordinary case readable.
 */
async function refuseDuplicateName(name: string, exceptId: string | null): Promise<void> {
  const [existing] = await getDb()
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.name, name))
    .limit(1)

  if (existing && existing.id !== exceptId) {
    throw new CategoryNameTakenError(name)
  }
}

function toCategory(row: typeof categories.$inferSelect): Category {
  return { id: row.id, name: row.name }
}
