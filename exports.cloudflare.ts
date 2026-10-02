/**
 * Exports supplementaires du Worker.
 *
 * Nitro detecte ce fichier et ajoute ses exports a l'entree du Worker. C'est
 * ce qui permet a Cloudflare de trouver la classe `Realtime` nommee dans
 * `wrangler.jsonc` : un binding Durable Object pointe vers une classe exportee
 * par le Worker, et le handler genere par Nitro n'exporte que lui-meme.
 *
 * Pas d'export par defaut ici : il entrerait en conflit avec celui de Nitro.
 */
export { Realtime } from './src/server/realtime'
