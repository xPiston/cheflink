/**
 * Generates `src/paraglide` outside of Vite.
 *
 * `npm run build`, `npm run dev` and `npm test` all go through Vite, where the
 * Paraglide plugin does this itself. `tsc --noEmit` does not, and the generated
 * directory is not committed, so on a fresh clone - or in CI, where
 * `typecheck` runs before `build` - the import of `#/paraglide/messages` would
 * point at nothing.
 *
 * The options come from `i18n.config.ts`, the same ones the Vite plugin uses.
 */
import { compile } from '@inlang/paraglide-js'

import { paraglideOptions } from '../i18n.config.ts'

await compile(paraglideOptions)
