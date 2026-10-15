import { createServerFn } from '@tanstack/react-start'
import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { getDb } from '#/db/client'
import { categories, dishes } from '#/db/schema'
import { DEFAULT_DISH_COLOR, DISH_COLORS, isDishColor, type DishColor } from '#/lib/colors'
import { m } from '#/paraglide/messages'
import { newId, requireUser } from '#/server/auth'
import { publish } from '#/server/events'
import { CategoryNotFoundError, type Category } from '#/server/functions/categories'

export type Dish = {
  id: string
  name: string
  description: string | null
  category: Category
  /** How it is drawn on the counter screen and in the kitchen. */
  color: DishColor
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
  /**
   * The category is now a reference, and this is what keeps `category_id`
   * effectively NOT NULL: SQLite could not be told to (see src/db/schema.ts),
   * so no dish gets written without one from here.
   */
  categoryId: z.string().uuid({ error: () => m.error_dish_category_required() }),
  /**
   * An enum, so a colour the interface does not offer cannot reach the
   * database. The palette is defined once in `src/lib/colors.ts` and this is
   * the only place that guards the way in.
   */
  color: z.enum(DISH_COLORS),
  available: z.boolean(),
})

export const listDishes = createServerFn({ method: 'GET' }).handler(async (): Promise<Dish[]> => {
  await requireUser()

  const rows = await getDb()
    .select({ dish: dishes, category: categories })
    .from(dishes)
    // A LEFT join, although the application never writes a dish without a
    // category: an inner one would make such a dish disappear from the only
    // screen that could repair it. See `toDish`.
    .leftJoin(categories, eq(categories.id, dishes.categoryId))
    .orderBy(asc(categories.name), asc(dishes.name))

  return rows.map((row) => toDish(row.dish, row.category))
})

export const createDish = createServerFn({ method: 'POST' })
  .validator(dishInput)
  .handler(async ({ data }): Promise<Dish> => {
    await requireUser()

    const db = getDb()
    const category = await requireCategory(data.categoryId)

    const [row] = await db
      .insert(dishes)
      .values({
        id: newId(),
        name: data.name,
        description: data.description || null,
        categoryId: category.id,
        color: data.color,
        available: data.available,
      })
      .returning()

    await publish({ type: 'dishes.changed' })

    return toDish(row, category)
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

    const category = await requireCategory(data.categoryId)

    const [row] = await getDb()
      .update(dishes)
      .set({
        name: data.name,
        description: data.description || null,
        categoryId: category.id,
        color: data.color,
        available: data.available,
      })
      .where(eq(dishes.id, data.id))
      .returning()

    if (!row) {
      throw new DishNotFoundError(data.id)
    }

    await publish({ type: 'dishes.changed' })

    return toDish(row, category)
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

/**
 * The category a dish is about to point at, or a refusal.
 *
 * Checked rather than trusted: the id comes from the browser, and a dangling
 * one would otherwise be written and only noticed on the screen that reads it.
 */
async function requireCategory(categoryId: string): Promise<Category> {
  const [row] = await getDb()
    .select()
    .from(categories)
    .where(eq(categories.id, categoryId))
    .limit(1)

  if (!row) {
    throw new CategoryNotFoundError(categoryId)
  }

  return { id: row.id, name: row.name }
}

function toDish(
  row: typeof dishes.$inferSelect,
  category: typeof categories.$inferSelect | Category | null
): Dish {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    // The column is plain text, so the palette is re-checked on the way out:
    // a value written by an older version of the application, or by hand,
    // must not reach a screen as a class name that does not exist.
    color: isDishColor(row.color) ? row.color : DEFAULT_DISH_COLOR,
    /**
     * A dish with no category keeps a placeholder rather than a null, so that
     * every screen can write `dish.category.name` without a guard. The empty
     * id is what makes it recognisable: the edit dialog opens with no category
     * selected and will not save until one is chosen, which is the repair.
     */
    category: category
      ? { id: category.id, name: category.name }
      : { id: '', name: m.dishes_no_category() },
    available: row.available,
  }
}
