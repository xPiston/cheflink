import { Check } from 'lucide-react'

import { DISH_COLORS, type DishColor } from '#/lib/colors'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'

/**
 * What a colour token looks like, and the only place that knows.
 *
 * Three shapes per token, because the colour has three jobs on three screens:
 * a DOT beside a line on the kitchen card, where it has to be findable out of
 * the corner of an eye; a BAR down the side of a dish on the counter screen,
 * which is a bigger target for a faster glance; and the swatch in the picker,
 * where TICK is the mark drawn on the chosen one - dark on white, white on
 * everything else, because a grey tick on violet is a tick nobody sees.
 *
 * Every entry names both themes. White is the neutral one - what every dish
 * got when the colours arrived - so it is drawn as a ring and a grey edge
 * rather than as white paint: on a light theme a white bar down a white card
 * is no bar at all.
 *
 * The classes are written out in full rather than built from a template:
 * Tailwind reads this file as text, and `bg-${color}-500` is a class it never
 * sees and never generates.
 */
const STYLES: Record<DishColor, { dot: string; bar: string; tick: string }> = {
  blanc: {
    dot: 'bg-white ring-1 ring-zinc-300 dark:ring-zinc-500',
    bar: 'border-l-zinc-300 dark:border-l-zinc-600',
    tick: 'text-zinc-900',
  },
  rouge: { dot: 'bg-red-500', bar: 'border-l-red-500', tick: 'text-white' },
  orange: { dot: 'bg-orange-500', bar: 'border-l-orange-500', tick: 'text-white' },
  ambre: { dot: 'bg-amber-500', bar: 'border-l-amber-500', tick: 'text-white' },
  vert: { dot: 'bg-emerald-500', bar: 'border-l-emerald-500', tick: 'text-white' },
  bleu: { dot: 'bg-sky-500', bar: 'border-l-sky-500', tick: 'text-white' },
  violet: { dot: 'bg-violet-500', bar: 'border-l-violet-500', tick: 'text-white' },
  rose: { dot: 'bg-pink-500', bar: 'border-l-pink-500', tick: 'text-white' },
}

/**
 * The name of a colour, for whoever is not reading it.
 *
 * A grid of coloured squares says nothing to a screen reader, and "the third
 * one" says nothing over the phone either. Written as a lookup of message
 * FUNCTIONS rather than of strings: a string here would be resolved when this
 * module loads, in whatever language that happened to be.
 */
const COLOR_NAMES: Record<DishColor, () => string> = {
  blanc: m.color_blanc,
  rouge: m.color_rouge,
  orange: m.color_orange,
  ambre: m.color_ambre,
  vert: m.color_vert,
  bleu: m.color_bleu,
  violet: m.color_violet,
  rose: m.color_rose,
}

export function colorName(color: DishColor): string {
  return COLOR_NAMES[color]()
}

/** A line's dish, at a glance. Decorative: the name is next to it. */
export function DishDot({ color, className }: { color: DishColor; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block size-2.5 shrink-0 rounded-full', STYLES[color].dot, className)}
    />
  )
}

/**
 * The classes that paint a dish's own edge, for a card to merge with its own.
 *
 * Returned rather than wrapped in a component: the counter screen already has
 * a `<Card>` with its own styling, and a second element around it to carry
 * four pixels of colour would be a div for nothing.
 */
export function dishBarClass(color: DishColor): string {
  return cn('border-l-4', STYLES[color].bar)
}

/**
 * Choosing a colour: the whole palette, visible at once.
 *
 * A native `<select>` of colour names would be smaller and worse - the thing
 * being chosen is the look of it, and a list of words makes you open eight
 * times to see eight colours. Hence the swatches, with the name on each as an
 * accessible label and a tick on the one in use, because colour alone cannot
 * say "selected" to someone who does not see it.
 */
export function DishColorPicker({
  value,
  onChange,
  disabled,
}: {
  value: DishColor
  onChange: (color: DishColor) => void
  disabled?: boolean
}) {
  return (
    <div role="radiogroup" aria-label={m.dishes_color()} className="flex flex-wrap gap-2">
      {DISH_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={color === value}
          aria-label={colorName(color)}
          disabled={disabled}
          onClick={() => onChange(color)}
          className={cn(
            'flex size-9 items-center justify-center rounded-full border transition',
            'focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
            color === value ? 'border-foreground' : 'border-transparent hover:border-border',
          )}
        >
          <span
            className={cn('flex size-6 items-center justify-center rounded-full', STYLES[color].dot)}
          >
            {color === value ? (
              <Check className={cn('size-3.5', STYLES[color].tick)} aria-hidden strokeWidth={3} />
            ) : null}
          </span>
        </button>
      ))}
    </div>
  )
}
