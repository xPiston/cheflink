import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    nitro({
      // Cible de deploiement : Cloudflare Workers. Nitro lit wrangler.jsonc
      // pour les bindings et les emule en local avec Miniflare, de sorte que
      // `npm run dev` tourne contre une vraie D1 et un vrai Durable Object.
      preset: 'cloudflare_module',
      rollupConfig: { external: [/^@sentry\//] },
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
