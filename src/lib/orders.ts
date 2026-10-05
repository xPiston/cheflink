/**
 * The rules of an order, in plain TypeScript.
 *
 * This file imports neither the database, nor React, nor the server: it runs on
 * both sides and is testable without starting anything (see
 * src/lib/orders.test.ts). It is the only place that decides what an order is
 * allowed to become.
 *
 * There is NO price here, nor anywhere else: the app carries orders to the
 * kitchen, it does not take payment. The bill is settled at the till.
 */

export const ORDER_STATUS = {
  /** Sent by the bar, showing in the kitchen, not served yet. */
  Pending: 'en_attente',
  /** The kitchen tapped the card: it is ready. */
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
 * Completing an already completed order is not an error worth showing: during
 * service two people tap the same card a second apart. So "refused" (an
 * impossible state) is kept distinct from "already done" (a no-op).
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
 * Merges the lines of a single order.
 *
 * Two taps on the same dish make one line of 2, not two lines of 1: the kitchen
 * reads a card, not a shopping list.
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

/** How long the order has been waiting, for the badge on the kitchen card. */
export function waitingMinutes(createdAt: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / 60_000))
}

/**
 * How urgent a kitchen card is. The thresholds live here rather than in the
 * JSX: this is a rule of service, not a colour.
 */
export function urgency(waitedMinutes: number): 'calme' | 'presse' | 'tres_presse' {
  if (waitedMinutes >= 15) return 'tres_presse'
  if (waitedMinutes >= 8) return 'presse'
  return 'calme'
}
