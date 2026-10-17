import { Check, Pipette } from 'lucide-react'
import { useRef, type CSSProperties } from 'react'

import {
  asCustomColor,
  CUSTOM_COLOR_SEED,
  DISH_COLORS,
  isDishToken,
  type CustomDishColor,
  type DishColor,
  type DishToken,
} from '#/lib/colors'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'

/**
 * What a colour looks like, and the only place that knows.
 *
 * Three shapes per token, because the colour has three jobs on three screens:
 * a DOT beside a line on the kitchen card, where it has to be findable out of
 * the corner of an eye; a BAR down the side of a dish on the counter screen,
 * which is a bigger target for a faster glance; and the swatch in the picker,
 * where TICK is the mark drawn on the chosen one - dark on pale, white on
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
const STYLES: Record<DishToken, { dot: string; bar: string; tick: string }> = {
  blanc: {
    dot: 'bg-white ring-1 ring-zinc-300 dark:ring-zinc-500',
    bar: 'border-l-zinc-300 dark:border-l-zinc-600',
    tick: 'text-zinc-900',
  },
  gris: { dot: 'bg-zinc-400', bar: 'border-l-zinc-400', tick: 'text-white' },
  rouge: { dot: 'bg-red-500', bar: 'border-l-red-500', tick: 'text-white' },
  orange: { dot: 'bg-orange-500', bar: 'border-l-orange-500', tick: 'text-white' },
  ambre: { dot: 'bg-amber-500', bar: 'border-l-amber-500', tick: 'text-white' },
  jaune: { dot: 'bg-yellow-400', bar: 'border-l-yellow-400', tick: 'text-zinc-900' },
  citron: { dot: 'bg-lime-400', bar: 'border-l-lime-400', tick: 'text-zinc-900' },
  vert: { dot: 'bg-emerald-500', bar: 'border-l-emerald-500', tick: 'text-white' },
  jade: { dot: 'bg-teal-500', bar: 'border-l-teal-500', tick: 'text-white' },
  turquoise: { dot: 'bg-cyan-400', bar: 'border-l-cyan-400', tick: 'text-zinc-900' },
  bleu: { dot: 'bg-sky-500', bar: 'border-l-sky-500', tick: 'text-white' },
  indigo: { dot: 'bg-indigo-500', bar: 'border-l-indigo-500', tick: 'text-white' },
  violet: { dot: 'bg-violet-500', bar: 'border-l-violet-500', tick: 'text-white' },
  fuchsia: { dot: 'bg-fuchsia-500', bar: 'border-l-fuchsia-500', tick: 'text-white' },
  rose: { dot: 'bg-pink-500', bar: 'border-l-pink-500', tick: 'text-white' },
  marron: { dot: 'bg-amber-800', bar: 'border-l-amber-800', tick: 'text-white' },
}

/**
 * The name of a colour, for whoever is not reading it.
 *
 * A grid of coloured squares says nothing to a screen reader, and "the third
 * one" says nothing over the phone either. Written as a lookup of message
 * FUNCTIONS rather than of strings: a string here would be resolved when this
 * module loads, in whatever language that happened to be.
 */
const COLOR_NAMES: Record<DishToken, () => string> = {
  blanc: m.color_blanc,
  gris: m.color_gris,
  rouge: m.color_rouge,
  orange: m.color_orange,
  ambre: m.color_ambre,
  jaune: m.color_jaune,
  citron: m.color_citron,
  vert: m.color_vert,
  jade: m.color_jade,
  turquoise: m.color_turquoise,
  bleu: m.color_bleu,
  indigo: m.color_indigo,
  violet: m.color_violet,
  fuchsia: m.color_fuchsia,
  rose: m.color_rose,
  marron: m.color_marron,
}

/** A custom colour has no name, so it is announced by its own value. */
export function colorName(color: DishColor): string {
  return isDishToken(color) ? COLOR_NAMES[color]() : m.color_custom_named({ hex: color })
}

/**
 * How light a custom colour is, to decide what the tick on it is drawn in.
 *
 * Relative luminance, the sRGB one, rather than the average of the three
 * channels: pure blue and pure yellow average the same and are nowhere near
 * as bright. The threshold is set where the hand-written table above puts it -
 * white on everything but the palest few - rather than at the WCAG figure,
 * which would ask for a dark tick on half the palette. It is a mark that
 * repeats `aria-checked`, not the only way of knowing.
 */
function isPale(color: CustomDishColor): boolean {
  const channel = (at: number): number => {
    const value = Number.parseInt(color.slice(at, at + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }

  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5) > 0.4
}

/**
 * The paint for one colour: classes for a token, a style for a custom one.
 *
 * Two mechanisms rather than one, and not for the fun of it. A token is a pair
 * of Tailwind classes so each theme renders its own shade; a custom colour is
 * a single value chosen by hand, which no class can hold - Tailwind only
 * generates what it reads in this file - so it travels as an inline style. The
 * ring is what keeps a custom near-white from vanishing on a white card.
 */
function paint(color: DishColor, part: 'dot' | 'bar'): { className: string; style?: CSSProperties } {
  if (isDishToken(color)) {
    return { className: STYLES[color][part] }
  }

  return part === 'dot'
    ? {
        className: 'ring-1 ring-black/15 dark:ring-white/20',
        style: { backgroundColor: color },
      }
    : { className: '', style: { borderLeftColor: color } }
}

/** A line's dish, at a glance. Decorative: the name is next to it. */
export function DishDot({ color, className }: { color: DishColor; className?: string }) {
  const dot = paint(color, 'dot')

  return (
    <span
      aria-hidden
      className={cn('inline-block size-2.5 shrink-0 rounded-full', dot.className, className)}
      style={dot.style}
    />
  )
}

/**
 * The paint for a dish's own edge, for a card to merge with its own.
 *
 * Returned rather than wrapped in a component: the counter screen already has
 * a `<Card>` with its own styling, and a second element around it to carry
 * four pixels of colour would be a div for nothing.
 */
export function dishBar(color: DishColor): { className: string; style?: CSSProperties } {
  const bar = paint(color, 'bar')

  return { className: cn('border-l-4', bar.className), style: bar.style }
}

/**
 * Choosing a colour: the whole palette, visible at once, and a way out of it.
 *
 * A native `<select>` of colour names would be smaller and worse - the thing
 * being chosen is the look of it, and a list of words makes you open sixteen
 * times to see sixteen colours. Hence the swatches, with the name on each as
 * an accessible label and a tick on the one in use, because colour alone
 * cannot say "selected" to someone who does not see it.
 *
 * The last swatch is the house's own colour. It is a radio like the others -
 * "a custom colour" is one of the choices - and the `<input type="color">`
 * behind it is only the mechanism: the browser's own picker, which is the one
 * thing here that is already familiar on a tablet, already translated and
 * already reachable by keyboard. It sits outside the group, hidden from
 * everyone, because what the user is choosing is announced by the radio.
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
  const input = useRef<HTMLInputElement>(null)
  const custom = isDishToken(value) ? null : value

  const openPicker = () => {
    const element = input.current
    if (!element) {
      return
    }

    // `showPicker` is what opens it where the input cannot be seen; clicking
    // is the fallback for a browser that does not have it yet.
    if (typeof element.showPicker === 'function') {
      element.showPicker()
    } else {
      element.click()
    }
  }

  return (
    // `relative` for the hidden input below: `sr-only` positions it
    // absolutely, and the browser opens the native picker where the input is.
    <div className="relative space-y-2">
      <div role="radiogroup" aria-label={m.dishes_color()} className="flex flex-wrap gap-2">
        {DISH_COLORS.map((color) => (
          <Swatch
            key={color}
            checked={color === value}
            label={colorName(color)}
            disabled={disabled}
            onSelect={() => onChange(color)}
            swatchClassName={STYLES[color].dot}
          >
            {color === value ? <Tick className={STYLES[color].tick} /> : null}
          </Swatch>
        ))}

        <Swatch
          checked={custom !== null}
          label={custom ? colorName(custom) : m.color_custom()}
          disabled={disabled}
          onSelect={openPicker}
          swatchClassName={custom ? 'ring-1 ring-black/15 dark:ring-white/20' : undefined}
          swatchStyle={
            custom
              ? { backgroundColor: custom }
              : // The rainbow says "any colour" in a way no single shade can,
                // and it is the one swatch that stands for a choice rather
                // than for a value.
                {
                  backgroundImage:
                    'conic-gradient(#ef4444,#eab308,#22c55e,#06b6d4,#3b82f6,#d946ef,#ef4444)',
                }
          }
        >
          {custom ? (
            <Tick className={isPale(custom) ? 'text-zinc-900' : 'text-white'} />
          ) : (
            <Pipette className="size-3.5 text-white drop-shadow-sm" aria-hidden strokeWidth={2.5} />
          )}
        </Swatch>
      </div>

      <input
        ref={input}
        type="color"
        tabIndex={-1}
        aria-hidden
        disabled={disabled}
        value={custom ?? CUSTOM_COLOR_SEED}
        onChange={(event) => {
          const picked = asCustomColor(event.target.value)
          if (picked) {
            onChange(picked)
          }
        }}
        className="sr-only"
      />

      {/*
        The value in writing, under the swatches: a colour chosen six months
        ago is impossible to name, and this is what gets read out loud when the
        second site is asked to use the same one.
      */}
      {custom ? <p className="font-mono text-xs text-muted-foreground">{custom}</p> : null}
    </div>
  )
}

/** One swatch, so that the sixteen and the custom one cannot drift apart. */
function Swatch({
  checked,
  label,
  disabled,
  onSelect,
  swatchClassName,
  swatchStyle,
  children,
}: {
  checked: boolean
  label: string
  disabled?: boolean
  onSelect: () => void
  swatchClassName?: string
  swatchStyle?: CSSProperties
  children?: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'flex size-9 items-center justify-center rounded-full border transition',
        'focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
        checked ? 'border-foreground' : 'border-transparent hover:border-border'
      )}
    >
      <span
        className={cn('flex size-6 items-center justify-center rounded-full', swatchClassName)}
        style={swatchStyle}
      >
        {children}
      </span>
    </button>
  )
}

function Tick({ className }: { className: string }) {
  return <Check className={cn('size-3.5', className)} aria-hidden strokeWidth={3} />
}
