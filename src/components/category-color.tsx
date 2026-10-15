import { Check } from 'lucide-react'

import { Badge } from '#/components/ui/badge'
import { CATEGORY_COLORS, type CategoryColor } from '#/lib/categories'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'

/**
 * What a colour token looks like, and the only place that knows.
 *
 * Two shapes per token, because the colour has two jobs on three screens: a
 * DOT beside a line on the kitchen card, where it has to be findable out of
 * the corner of an eye, and a BADGE carrying the category's name on the
 * counter screen and the dishes page.
 *
 * Every entry names both themes. The app already learnt this the hard way
 * with the allergy note in the kitchen: one shade of amber cannot serve both
 * - light on a dark background it turns pale yellow on pale yellow the moment
 * the theme goes light. So the fill stays a transparency of the pure colour,
 * which both backgrounds take, and the TEXT is what changes.
 *
 * `tick` is the third one: the mark drawn ON the swatch when that colour is
 * the chosen one. Dark on white, white on everything else - a grey tick on
 * violet is a tick nobody sees.
 *
 * The classes are written out in full rather than built from a template:
 * Tailwind reads this file as text, and `bg-${color}-500` is a class it never
 * sees and never generates.
 */
const STYLES: Record<CategoryColor, { dot: string; badge: string; tick: string }> = {
  // White is the neutral one - what every category got when the colours
  // arrived - so it is drawn as a ring rather than a fill: on the counter
  // screen a white badge would shout louder than the colours that were
  // actually chosen.
  blanc: {
    dot: 'bg-white ring-1 ring-zinc-300 dark:ring-zinc-500',
    badge: 'border-zinc-300 bg-white text-zinc-900 dark:border-zinc-500 dark:bg-transparent dark:text-zinc-100',
    tick: 'text-zinc-900',
  },
  rouge: {
    dot: 'bg-red-500',
    badge: 'border-red-500/40 bg-red-500/15 text-red-900 dark:bg-red-500/10 dark:text-red-200',
    tick: 'text-white',
  },
  orange: {
    dot: 'bg-orange-500',
    badge: 'border-orange-500/40 bg-orange-500/15 text-orange-900 dark:bg-orange-500/10 dark:text-orange-200',
    tick: 'text-white',
  },
  ambre: {
    dot: 'bg-amber-500',
    badge: 'border-amber-500/40 bg-amber-500/15 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200',
    tick: 'text-white',
  },
  vert: {
    dot: 'bg-emerald-500',
    badge:
      'border-emerald-500/40 bg-emerald-500/15 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200',
    tick: 'text-white',
  },
  bleu: {
    dot: 'bg-sky-500',
    badge: 'border-sky-500/40 bg-sky-500/15 text-sky-900 dark:bg-sky-500/10 dark:text-sky-200',
    tick: 'text-white',
  },
  violet: {
    dot: 'bg-violet-500',
    badge:
      'border-violet-500/40 bg-violet-500/15 text-violet-900 dark:bg-violet-500/10 dark:text-violet-200',
    tick: 'text-white',
  },
  rose: {
    dot: 'bg-pink-500',
    badge: 'border-pink-500/40 bg-pink-500/15 text-pink-900 dark:bg-pink-500/10 dark:text-pink-200',
    tick: 'text-white',
  },
}

/**
 * The name of a colour, for whoever is not reading it.
 *
 * A grid of coloured squares says nothing to a screen reader, and "the third
 * one" says nothing over the phone either. Written as a lookup of message
 * FUNCTIONS rather than of strings: a string here would be resolved when this
 * module loads, in whatever language that happened to be.
 */
const COLOR_NAMES: Record<CategoryColor, () => string> = {
  blanc: m.color_blanc,
  rouge: m.color_rouge,
  orange: m.color_orange,
  ambre: m.color_ambre,
  vert: m.color_vert,
  bleu: m.color_bleu,
  violet: m.color_violet,
  rose: m.color_rose,
}

export function colorName(color: CategoryColor): string {
  return COLOR_NAMES[color]()
}

/** A line's category, at a glance. Decorative: the name is next to it. */
export function CategoryDot({ color, className }: { color: CategoryColor; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block size-2.5 shrink-0 rounded-full', STYLES[color].dot, className)}
    />
  )
}

/** A category, named and coloured. */
export function CategoryBadge({
  name,
  color,
  className,
}: {
  name: string
  color: CategoryColor
  className?: string
}) {
  return (
    <Badge variant="outline" className={cn(STYLES[color].badge, className)}>
      {name}
    </Badge>
  )
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
export function CategoryColorPicker({
  value,
  onChange,
  disabled,
}: {
  value: CategoryColor
  onChange: (color: CategoryColor) => void
  disabled?: boolean
}) {
  return (
    <div role="radiogroup" aria-label={m.categories_color()} className="flex flex-wrap gap-2">
      {CATEGORY_COLORS.map((color) => (
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
          <span className={cn('flex size-6 items-center justify-center rounded-full', STYLES[color].dot)}>
            {color === value ? (
              <Check className={cn('size-3.5', STYLES[color].tick)} aria-hidden strokeWidth={3} />
            ) : null}
          </span>
        </button>
      ))}
    </div>
  )
}
