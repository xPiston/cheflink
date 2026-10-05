import { type Locale } from '#/paraglide/runtime'

/**
 * The language, a property of the DEVICE - like the theme and the bar/kitchen
 * mode.
 *
 * Unlike those two, it is kept in a cookie rather than in `localStorage`, and
 * that is the whole point: the server reads cookies. It can therefore render
 * the first HTML in the right language instead of sending French and letting
 * React correct it a moment later, which would show a flash of the wrong
 * language on every page load. The cookie is named `cheflink.locale` and is
 * written by Paraglide's `setLocale` (see i18n.config.ts).
 *
 * `Locale` itself is generated from `project.inlang/settings.json`: adding a
 * language there is enough for the type, and the compiler then points at every
 * place that has to handle it - which is how these two records know they are
 * still complete.
 */

/**
 * Each language in its own words.
 *
 * Not translated on purpose: someone looking for their language scans for the
 * word they would use themselves. "Anglais" helps nobody who does not already
 * read French.
 */
export const LOCALE_LABEL: Record<Locale, string> = {
  fr: 'Français',
  en: 'English',
  es: 'Español',
  pt: 'Português',
}

/**
 * The region tags used for formatting dates and times.
 *
 * `Intl` needs more than a language to lay out a date: plain `'en'` means the
 * United States, so 05/10 would read as the 5th of October in French and the
 * 10th of May in English - the same screen, two meanings. The app runs in a
 * French venue, so English here means British English, which puts the day
 * first like the rest of the room. The same reasoning picks `es-ES` and
 * `pt-PT` rather than their American cousins: day first, everywhere.
 */
const FORMAT_LOCALE: Record<Locale, string> = {
  fr: 'fr-FR',
  en: 'en-GB',
  es: 'es-ES',
  pt: 'pt-PT',
}

/** Short day/time, as used by the bar's history. */
export function dateTimeFormat(locale: Locale): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(FORMAT_LOCALE[locale], {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
