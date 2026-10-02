import { bindings } from './cloudflare'

/**
 * Ce que le serveur pousse vers les ecrans ouverts.
 *
 * Les evenements ne transportent QUE des identifiants, pas les commandes
 * entieres : les ecrans refont la requete en recevant le signal. C'est un
 * aller-retour de plus, mais ca evite deux representations de la meme commande
 * qui finiraient par diverger, et ca garde la charge utile anodine.
 */
export type AppEvent =
  | { type: 'order.created'; orderId: string }
  | { type: 'order.completed'; orderId: string }
  | { type: 'dishes.changed' }

/**
 * Le bar n'a qu'une salle : un seul hub, donc un seul identifiant de Durable
 * Object. Le jour ou l'application servirait plusieurs etablissements, c'est
 * cette constante qui deviendrait l'identifiant de l'etablissement - et rien
 * d'autre ne bougerait.
 */
const HUB = 'salle'

const DEGRADED =
  "Le Durable Object temps reel n'est pas disponible. C'est attendu sous `npm run dev`, " +
  "ou Nitro ne publie pas exports.cloudflare.ts : les ecrans ne se mettront a jour qu'au " +
  'rafraichissement de securite. Utilisez `npm run preview` pour le runtime Cloudflare complet.'

function hub() {
  const { REALTIME } = bindings()

  return REALTIME.get(REALTIME.idFromName(HUB))
}

/**
 * Diffuse un evenement a tous les ecrans connectes.
 *
 * Une panne du hub ne doit PAS faire echouer l'ecriture qui vient d'avoir lieu :
 * une commande enregistree et non diffusee est recuperable - les ecrans se
 * resynchronisent a la reconnexion et au rafraichissement de securite - alors
 * qu'une commande perdue ne l'est pas. On journalise donc bruyamment et on
 * continue, plutot que d'annuler.
 *
 * L'URL passee au stub est arbitraire : un Durable Object ne repond pas sur le
 * reseau, c'est un appel direct, et seul le chemin sert d'aiguillage interne
 * (voir Realtime.fetch).
 */
export async function publish(event: AppEvent): Promise<void> {
  try {
    await hub().fetch('https://hub/publish', {
      method: 'POST',
      body: JSON.stringify(event),
    })
  } catch (error) {
    console.warn(`[cheflink] evenement ${event.type} non diffuse. ${DEGRADED}`, error)
  }
}

/** Transmet au hub la requete d'un ecran qui veut ouvrir son WebSocket. */
export async function connect(request: Request): Promise<Response> {
  try {
    return await hub().fetch(request)
  } catch (error) {
    console.warn(`[cheflink] connexion temps reel refusee. ${DEGRADED}`, error)

    // 503 et non 500 : le client doit comprendre qu'il peut reessayer, ce que
    // fait la boucle de reconnexion de useAppEvents.
    return new Response(DEGRADED, { status: 503 })
  }
}
