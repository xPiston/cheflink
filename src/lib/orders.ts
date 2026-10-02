/**
 * Les regles d'une commande, en TypeScript pur.
 *
 * Ce fichier n'importe ni la base, ni React, ni le serveur : il est importable
 * des deux cotes et testable sans rien demarrer (voir src/lib/orders.test.ts).
 * C'est le seul endroit qui decide ce qu'une commande a le droit de devenir.
 *
 * Il n'y a PAS de prix ici, ni nulle part ailleurs : l'application sert a
 * transmettre des commandes a la cuisine, pas a encaisser. L'addition se fait
 * en caisse.
 */

export const ORDER_STATUS = {
  /** Envoyee par le bar, affichee en cuisine, pas encore servie. */
  Pending: 'en_attente',
  /** La cuisine a tape sur la carte : c'est pret. */
  Done: 'terminee',
} as const

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS]

const TRANSITIONS: Record<OrderStatus, ReadonlyArray<OrderStatus>> = {
  [ORDER_STATUS.Pending]: [ORDER_STATUS.Done],
  [ORDER_STATUS.Done]: [],
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

/**
 * Terminer une commande deja terminee n'est pas une erreur a afficher : en
 * service, deux personnes tapent sur la meme carte a une seconde d'intervalle.
 * On distingue donc "refus" (etat impossible) de "deja fait" (sans effet).
 */
export function isOrderStatus(value: string): value is OrderStatus {
  return value === ORDER_STATUS.Pending || value === ORDER_STATUS.Done
}

export type OrderLineInput = {
  dishId: string
  quantity: number
}

export class EmptyOrderError extends Error {
  constructor() {
    super('Une commande doit contenir au moins un plat.')
    this.name = 'EmptyOrderError'
  }
}

export class InvalidQuantityError extends Error {
  constructor(readonly quantity: number) {
    super(`Quantite invalide : ${quantity}. Attendu un entier entre 1 et 99.`)
    this.name = 'InvalidQuantityError'
  }
}

export class UnavailableDishError extends Error {
  constructor(readonly dishName: string) {
    super(`"${dishName}" n'est plus disponible.`)
    this.name = 'UnavailableDishError'
  }
}

/**
 * Regroupe les lignes d'une meme commande.
 *
 * Deux clics sur le meme plat font une ligne a 2, pas deux lignes a 1 : la
 * cuisine lit une carte, pas une liste de courses.
 */
export function mergeLines(lines: ReadonlyArray<OrderLineInput>): Array<OrderLineInput> {
  const merged = new Map<string, number>()

  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 99) {
      throw new InvalidQuantityError(line.quantity)
    }

    merged.set(line.dishId, (merged.get(line.dishId) ?? 0) + line.quantity)
  }

  const result = [...merged].map(([dishId, quantity]) => ({ dishId, quantity }))

  if (result.length === 0) {
    throw new EmptyOrderError()
  }

  for (const line of result) {
    if (line.quantity > 99) {
      throw new InvalidQuantityError(line.quantity)
    }
  }

  return result
}

/** Depuis combien de temps la commande attend, pour la pastille de la cuisine. */
export function waitingMinutes(createdAt: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / 60_000))
}

/**
 * L'urgence d'une carte en cuisine. Les seuils sont ici et pas dans le JSX :
 * c'est une regle de service, pas une couleur.
 */
export function urgency(waitedMinutes: number): 'calme' | 'presse' | 'tres_presse' {
  if (waitedMinutes >= 15) return 'tres_presse'
  if (waitedMinutes >= 8) return 'presse'
  return 'calme'
}
