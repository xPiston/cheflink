/**
 * The colours a category can take, in plain TypeScript.
 *
 * Like `src/lib/orders.ts`, this file imports nothing at all: it holds the
 * list of tokens and the guard that says whether a string is one of them.
 * What a token LOOKS like belongs to the interface and lives in
 * `src/components/category-color.tsx` - there is no Tailwind class and no hex
 * here, because the rule "a category has a colour" is not a rule about pixels.
 *
 * Tokens rather than colours, for a reason the app already ran into with the
 * allergy note in the kitchen: `#f59e0b` stored in the database is a fact
 * about ONE theme. The counter station and the kitchen tablet are not under
 * the same light, the app has a light mode and a dark one, and a shade that is
 * legible in one is a smear in the other. A token lets each theme pick its own
 * shade for "ambre" and keeps the database out of it.
 *
 * The values are French, like the order statuses in `src/lib/orders.ts`: what
 * goes into the database is written in the language of the house.
 */
export const CATEGORY_COLORS = [
  'blanc',
  'rouge',
  'orange',
  'ambre',
  'vert',
  'bleu',
  'violet',
  'rose',
] as const

export type CategoryColor = (typeof CATEGORY_COLORS)[number]

/**
 * What a category gets when nobody has chosen one.
 *
 * White, and not by accident: it is the only shade that reads as "nobody has
 * decided yet" rather than as a meaning of its own. Every category that
 * existed before the colours arrived is white (see
 * `drizzle/0003_category_colors.sql`), so the card looks exactly as it did the
 * day before, and a colour appears only where someone chose to put one.
 */
export const DEFAULT_CATEGORY_COLOR: CategoryColor = 'blanc'

export function isCategoryColor(value: string): value is CategoryColor {
  return (CATEGORY_COLORS as ReadonlyArray<string>).includes(value)
}
