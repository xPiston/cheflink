import { defineConfig } from 'vite'
import { paraglideVitePlugin } from '@inlang/paraglide-js'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

// With the extension: Vite's native config loader does not resolve a bare
// relative import, and warns about it on every run without it.
import { paraglideOptions } from './i18n.config.ts'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    // Compiles messages/{fr,en}.json into src/paraglide, and recompiles them
    // on change. See i18n.config.ts for the options, which are shared with
    // scripts/i18n-compile.ts.
    paraglideVitePlugin(paraglideOptions),
    nitro({
      // Deployment target: Cloudflare Workers. Nitro reads wrangler.jsonc for
      // the bindings and emulates them locally with Miniflare, so that
      // `npm run dev` runs against a real D1 and a real Durable Object.
      preset: 'cloudflare_module',
      rollupConfig: { external: [/^@sentry\//] },
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
