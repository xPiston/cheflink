import { defineConfig } from 'drizzle-kit'

/**
 * drizzle-kit configuration, used only to GENERATE migrations
 * (`npm run db:generate`).
 *
 * No `dbCredentials`: with D1, drizzle never connects to the database from this
 * machine. It is `wrangler d1 migrations apply` that applies the SQL produced
 * here, locally and in production alike.
 */
export default defineConfig({
  dialect: 'sqlite',
  driver: 'd1-http',
  schema: './src/db/schema.ts',
  out: './drizzle',
})
