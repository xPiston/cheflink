import { defineConfig } from 'drizzle-kit'

/**
 * Configuration de drizzle-kit, utilisee uniquement pour GENERER les migrations
 * (`npm run db:generate`).
 *
 * Pas de `dbCredentials` : avec D1, drizzle ne se connecte jamais a la base
 * depuis cette machine. C'est `wrangler d1 migrations apply` qui applique le
 * SQL produit ici, en local comme en production.
 */
export default defineConfig({
  dialect: 'sqlite',
  driver: 'd1-http',
  schema: './src/db/schema.ts',
  out: './drizzle',
})
