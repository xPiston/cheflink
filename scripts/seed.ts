import { writeFileSync } from 'node:fs'

import { hashPassword } from '../src/server/password.ts'

/**
 * Produit le SQL des donnees de demonstration.
 *
 * Sur Cloudflare, un Worker n'a pas de "demarrage" ou poser un seed : il
 * repond a des requetes, point. Les donnees initiales sont donc posees depuis
 * la ligne de commande, comme les migrations - `npm run db:seed`.
 *
 * Ce script ne parle pas a la base : il ECRIT du SQL, que wrangler applique
 * ensuite (en local ou en production selon `--remote`). Il peut donc tourner
 * sous Node sans aucun binding, tout en produisant un hash de mot de passe au
 * format exact que l'application sait verifier - c'est pour ca qu'il importe
 * `hashPassword` au lieu de le reimplementer.
 *
 * Le fichier produit est volontairement HORS de `drizzle/` : wrangler traite
 * tout .sql de ce dossier comme une migration, et le seed y serait rejoue a
 * chaque `migrations apply`, y compris en production.
 *
 * Tout est en `insert or ignore` : relancer le seed ne duplique rien.
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
