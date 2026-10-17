/**
 * The colours a dish can take, in plain TypeScript.
 *
 * Like `src/lib/orders.ts`, this file imports nothing at all: it holds the
 * list of tokens, the shape of a custom colour and the functions that say
 * whether a string is either. What a colour LOOKS like belongs to the
 * interface and lives in `src/components/dish-color.tsx` - there is no
 * Tailwind class here, because the rule "a dish has a colour" is not a rule
 * about pixels.
 *
 * The colour is on the DISH and not on its category. A category still groups
 * the card into sections, but two dishes of the same section can be told
 * apart on sight - the burger from the cheeseburger, in the one glance a cook
 * gives a card.
 *
 * Two kinds of value live in `dishes.color`, and the difference is deliberate:
 *
 * - a TOKEN - `ambre` - which each theme renders in its own shade. The counter
 *   station and the kitchen tablet are not under the same light, the app has a
 *   light mode and a dark one, and a shade that is legible in one is a smear in
 *   the other. A token lets each theme decide and keeps the database out of it.
 *
 * - a CUSTOM colour - `#7c3aed` - for the house that wants its own. It is one
 *   shade for both themes, which is exactly the compromise the tokens avoid,
 *   so the palette comes first and the picker is the way out of it.
 *
 * The tokens are French, like the order statuses in `src/lib/orders.ts`: what
 * goes into the database is written in the language of the house. They are
 * ordered as a spectrum rather than alphabetically - the picker shows them in
 * this order, and a grid of colours is read by hue, not by name.
 */
export const DISH_COLORS = [
  'blanc',
  'gris',
  'rouge',
  'orange',
  'ambre',
  'jaune',
  'citron',
  'vert',
  'jade',
  'turquoise',
  'bleu',
  'indigo',
  'violet',
  'fuchsia',
  'rose',
  'marron',
] as const

/** One of the house colours, named. */
export type DishToken = (typeof DISH_COLORS)[number]

/**
 * A colour picked by hand, as `#rrggbb`.
 *
 * Lower case and six digits, always: it is what `<input type="color">` hands
 * over, and normalising on the way in means two rows holding the same colour
 * hold the same string.
 */
export type CustomDishColor = `#${string}`

export type DishColor = DishToken | CustomDishColor

/** Six digits, lower case. Three-digit shorthand is not accepted, nor alpha. */
export const CUSTOM_COLOR_PATTERN = /^#[0-9a-f]{6}$/

/**
 * Where the native picker opens for a dish that wears a palette colour.
 *
 * A token has no hex in this file - that is the whole point of it - so the
 * picker needs somewhere to start. A mid blue, far enough from every edge of
 * the palette that the first drag goes somewhere useful.
 */
export const CUSTOM_COLOR_SEED: CustomDishColor = '#3b82f6'

/**
 * What a dish gets when nobody has chosen one.
 *
 * White, and not by accident: it is the only shade that reads as "nobody has
 * decided yet" rather than as a meaning of its own. Every dish that was
 * already on the card when the colours arrived is white (see
 * `drizzle/0004_dish_colors.sql`), so the card looks exactly as it did the day
 * before, and a colour appears only where someone chose to put one.
 */
export const DEFAULT_DISH_COLOR: DishToken = 'blanc'

export function isDishToken(value: string): value is DishToken {
  return (DISH_COLORS as ReadonlyArray<string>).includes(value)
}

/**
 * The custom colour this string holds, or nothing.
 *
 * The one place that turns text into a `CustomDishColor`, hence the one cast:
 * the regular expression is the proof, and TypeScript cannot read it.
 */
export function asCustomColor(value: string): CustomDishColor | null {
  const hex = value.trim().toLowerCase()
  return CUSTOM_COLOR_PATTERN.test(hex) ? (hex as CustomDishColor) : null
}

/**
 * The colour this string holds, or nothing - the only reader of the column.
 *
 * `dishes.color` is plain text, so what comes back is re-read rather than
 * trusted: a value written by an older version of the application, or by
 * hand, must not reach a screen as a class name that does not exist or as a
 * `background-color` the browser ignores.
 */
export function asDishColor(value: string): DishColor | null {
  const token = value.trim().toLowerCase()
  return isDishToken(token) ? token : asCustomColor(token)
}
