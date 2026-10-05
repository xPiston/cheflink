import type { CompilerOptions } from '@inlang/paraglide-js'

/**
 * Paraglide compiler options, shared by everything that generates
 * `src/paraglide`.
 *
 * Two things compile the messages and they must agree: the Vite plugin (dev,
 * build, tests) and `scripts/i18n-compile.ts`, which `npm run typecheck` calls
 * because `tsc --noEmit` runs without Vite and would otherwise type-check
 * against a directory that does not exist yet.
 *
 * Paraglide does support a `project.inlang/paraglide.config.ts`, which would be
 * the obvious home for this. It is not usable here: the inlang SDK rewrites
 * `project.inlang/.gitignore` to `*` plus `!settings.json` on every compile, so
 * a config file placed in there is ignored by git and would never reach a clone
 * or CI.
 */
export const paraglideOptions = {
  project: './project.inlang',
  outdir: './src/paraglide',

  /**
   * No `url` strategy: the locale never appears in the URL.
   *
   * The screens are bookmarked on fixed tablets behind a login, so there is
   * nothing to index and nothing to share. `/fr/cuisine` would only add
   * something more to keep in sync - starting with `/api/ws`, which must not be
   * localized at all.
   *
   * `cookie` comes first because it is the choice the user made explicitly, and
   * because the server can read it: the HTML comes back in the right language
   * on the first paint, with no flash of the wrong one. Then
   * `preferredLanguage`, from `Accept-Language`, for a device that has never
   * chosen. `baseLocale` (French) closes the list.
   *
   * `globalVariable`, which Paraglide includes by default, is deliberately left
   * out: it is a module-level variable, so a server handling two requests at
   * once could leak one visitor's language into another's page.
   */
  strategy: ['cookie', 'preferredLanguage', 'baseLocale'],

  // Same `cheflink.` prefix as the theme and mode keys in `localStorage`.
  cookieName: 'cheflink.locale',

  // One module per message, so a page only ships the messages it uses.
  outputStructure: 'message-modules',

  /**
   * Paraglide emits JavaScript with JSDoc types. `tsconfig.json` only picks up
   * `.ts`/`.tsx` and has no `allowJs`, so without declarations every
   * `#/paraglide/...` import would be an untyped module and `tsc --noEmit`
   * would refuse it. With them, a typo in a message name - or a missing
   * parameter - is a type error.
   */
  emitTsDeclarations: true,
} satisfies CompilerOptions
