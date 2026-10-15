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

/** The demo card's sections. A category groups, it does not colour. */
const CATEGORIES = ['A partager', 'Plats', 'Desserts']

/**
 * The demo dishes, each with a colour.
 *
 * Coloured rather than left white, unlike the dishes the migration finds
 * already on the card: a fresh install is somebody looking at the
 * application for the first time, and six white dishes would show the
 * feature switched off. The tokens are the ones in src/lib/colors.ts.
 */
const DISHES: Array<[name: string, description: string, category: string, color: string]> = [
  ['Planche mixte', 'Charcuterie, fromages, cornichons', 'A partager', 'ambre'],
  ['Frites maison', 'Sauce au choix', 'A partager', 'orange'],
  ['Croque-monsieur', 'Jambon blanc, comte', 'Plats', 'bleu'],
  ['Burger du bar', 'Steak 150 g, cheddar, oignons confits', 'Plats', 'rouge'],
  ['Salade cesar', 'Poulet grille, parmesan', 'Plats', 'vert'],
  ['Moelleux au chocolat', 'Coeur coulant', 'Desserts', 'rose'],
]

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`

const statements = [
  `insert or ignore into users (id, email, name, password_hash, created_at) values (${[
    quote(crypto.randomUUID()),
    quote(EMAIL),
    // Nothing reads this any more; the column is still NOT NULL.
    quote('Bar team'),
    quote(await hashPassword(PASSWORD)),
    Date.now(),
  ].join(', ')});`,
  ...CATEGORIES.map(
    (name) =>
      `insert or ignore into categories (id, name, created_at) values (${[
        quote(crypto.randomUUID()),
        quote(name),
        Date.now(),
      ].join(', ')});`
  ),
  ...DISHES.map(
    ([name, description, category, color]) =>
      // The category is looked up by name rather than by an id generated
      // here: on a second run the `insert or ignore` above changes nothing,
      // and an id from this run would point at a row that was never written.
      `insert or ignore into dishes (id, name, description, category_id, color, available, created_at) values (${[
        quote(crypto.randomUUID()),
        quote(name),
        quote(description),
        `(select id from categories where name = ${quote(category)})`,
        quote(color),
        1,
        Date.now(),
      ].join(', ')});`
  ),
]

const sql = `-- Genere par \`npm run db:seed\`. Ne pas editer a la main.\n${statements.join('\n')}\n`
writeFileSync('scripts/seed.generated.sql', sql)

console.info(`scripts/seed.generated.sql ecrit - compte : ${EMAIL} / ${PASSWORD}`)
