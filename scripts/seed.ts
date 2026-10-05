import { writeFileSync } from 'node:fs'

import { hashPassword } from '../src/server/password.ts'

/**
 * Produces the SQL for the demo data.
 *
 * On Cloudflare a Worker has no "startup" to hang a seed on: it answers
 * requests, full stop. Initial data is therefore laid down from the command
 * line, like the migrations - `npm run db:seed`.
 *
 * This script never talks to the database: it WRITES SQL, which wrangler then
 * applies (locally or in production depending on `--remote`). So it can run
 * under Node with no bindings at all, while producing a password hash in the
 * exact format the app knows how to verify - which is why it imports
 * `hashPassword` instead of reimplementing it.
 *
 * The file it produces deliberately lives OUTSIDE `drizzle/`: wrangler treats
 * every .sql in that folder as a migration, and the seed would be replayed on
 * each `migrations apply`, production included.
 *
 * Everything is `insert or ignore`: re-running the seed duplicates nothing.
 */
const EMAIL = process.env.SEED_EMAIL ?? 'bar@exemple.fr'
const PASSWORD = process.env.SEED_PASSWORD ?? 'motdepasse'

const DISHES: Array<[name: string, description: string, category: string]> = [
  ['Planche mixte', 'Charcuterie, fromages, cornichons', 'A partager'],
  ['Frites maison', 'Sauce au choix', 'A partager'],
  ['Croque-monsieur', 'Jambon blanc, comte', 'Plats'],
  ['Burger du bar', 'Steak 150 g, cheddar, oignons confits', 'Plats'],
  ['Salade cesar', 'Poulet grille, parmesan', 'Plats'],
  ['Moelleux au chocolat', 'Coeur coulant', 'Desserts'],
]

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`

const statements = [
  `insert or ignore into users (id, email, name, password_hash, created_at) values (${[
    quote(crypto.randomUUID()),
    quote(EMAIL),
    quote('Equipe du bar'),
    quote(await hashPassword(PASSWORD)),
    Date.now(),
  ].join(', ')});`,
  ...DISHES.map(
    ([name, description, category]) =>
      `insert or ignore into dishes (id, name, description, category, available, created_at) values (${[
        quote(crypto.randomUUID()),
        quote(name),
        quote(description),
        quote(category),
        1,
        Date.now(),
      ].join(', ')});`
  ),
]

const sql = `-- Genere par \`npm run db:seed\`. Ne pas editer a la main.\n${statements.join('\n')}\n`
writeFileSync('scripts/seed.generated.sql', sql)

console.info(`scripts/seed.generated.sql ecrit - compte : ${EMAIL} / ${PASSWORD}`)
