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
  /** The bar took it back: the table left, or it was never meant to be sent. */
  Cancelled: 'annulee',
} as const

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS]

/**
 * An order leaves `en_attente` once, in one of two directions, and never
 * comes back.
 *
 * A finished order cannot be cancelled: by then it has been cooked, and
 * pretending otherwise would hide a plate somebody has to deal with. A
 * cancelled one cannot be revived either - the kitchen stopped, and the way
 * to undo that is to send the order again, which is one tap at the bar and
 * leaves a trace of both.
 */
const TRANSITIONS: Record<OrderStatus, ReadonlyArray<OrderStatus>> = {
  [ORDER_STATUS.Pending]: [ORDER_STATUS.Done, ORDER_STATUS.Cancelled],
  [ORDER_STATUS.Done]: [],
  [ORDER_STATUS.Cancelled]: [],
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
  return (
    value === ORDER_STATUS.Pending ||
    value === ORDER_STATUS.Done ||
    value === ORDER_STATUS.Cancelled
  )
}

export type OrderLineInput = {
  dishId: string
  quantity: number
}

/**
 * The messages below are NOT translated, on purpose.
 *
 * Two reasons. They never reach a screen: the pages that can trigger them show
 * their own wording, because a broken rule means "this order is not valid", not
 * a sentence to paste in front of a customer. And this module is deliberately
 * dependency-free - the rules of the house, testable without a database, a
 * browser or a compiled message catalogue - which importing Paraglide here
 * would end.
 *
 * So they are what a developer reads in a log or a stack trace, and they are in
 * the same language as the code. The user-facing wording lives in
 * `messages/*.json`; what crosses the boundary is the error's NAME.
 */
export class EmptyOrderError extends Error {
  constructor() {
    super('An order must contain at least one dish.')
    this.name = 'EmptyOrderError'
  }
}

export class InvalidQuantityError extends Error {
  constructor(readonly quantity: number) {
    super(`Invalid quantity: ${quantity}. Expected an integer between 1 and 99.`)
    this.name = 'InvalidQuantityError'
  }
}

export class UnavailableDishError extends Error {
  constructor(readonly dishName: string) {
    super(`"${dishName}" is no longer available.`)
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

/**
 * The windows the history offers.
 *
 * Stored as plain day counts rather than labels: the screen translates them,
 * the server only has to subtract.
 */
export const HISTORY_PERIODS = {
  '1d': 1,
  '7d': 7,
  '30d': 30,
} as const

export type HistoryPeriod = keyof typeof HISTORY_PERIODS

/**
 * What the history opens on: the last twenty-four hours.
 *
 * It is the question the bar actually asks - "what went out tonight" - and
 * the cheapest of the three to answer.
 */
export const DEFAULT_HISTORY_PERIOD: HistoryPeriod = '1d'

export function isHistoryPeriod(value: string): value is HistoryPeriod {
  return value in HISTORY_PERIODS
}

/**
 * The oldest order a window includes.
 *
 * A ROLLING window, not a calendar one: "1 day" means the last twenty-four
 * hours, not "since midnight". A bar that closes at two in the morning is
 * still in the same service at one, and a history that emptied itself at
 * midnight would be useless at exactly the hour somebody checks it.
 */
export function periodStart(period: HistoryPeriod, now: Date): Date {
  return new Date(now.getTime() - HISTORY_PERIODS[period] * 24 * 60 * 60 * 1000)
}
