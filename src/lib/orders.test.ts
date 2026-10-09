import { describe, expect, it } from 'vitest'

import {
  EmptyOrderError,
  InvalidQuantityError,
  ORDER_STATUS,
  canTransition,
  isHistoryPeriod,
  isOrderStatus,
  mergeLines,
  periodStart,
  urgency,
  waitingMinutes,
} from './orders'

/**
 * The rules of an order, tested with no database, no server and no browser.
 *
 * That is the whole point of having pulled these functions out of the
 * components and the queries: the state machine and the line merging are
 * verifiable in milliseconds.
 */

describe('machine a etats', () => {
  it('ne connait que trois etats', () => {
    expect(isOrderStatus('en_attente')).toBe(true)
    expect(isOrderStatus('terminee')).toBe(true)
    expect(isOrderStatus('annulee')).toBe(true)
    expect(isOrderStatus('en_cours')).toBe(false)
  })

  it('va de en_attente a terminee, et pas en arriere', () => {
    expect(canTransition(ORDER_STATUS.Pending, ORDER_STATUS.Done)).toBe(true)
    expect(canTransition(ORDER_STATUS.Done, ORDER_STATUS.Pending)).toBe(false)
    expect(canTransition(ORDER_STATUS.Done, ORDER_STATUS.Done)).toBe(false)
  })

  it('va de en_attente a annulee', () => {
    expect(canTransition(ORDER_STATUS.Pending, ORDER_STATUS.Cancelled)).toBe(true)
  })

  /**
   * Les deux sorties sont definitives, et pour des raisons differentes : une
   * commande terminee a ete cuisinee, une commande annulee a fait arreter la
   * cuisine. Dans les deux cas, revenir en arriere effacerait un fait.
   */
  it('ne sort plus d une commande terminee ou annulee', () => {
    expect(canTransition(ORDER_STATUS.Done, ORDER_STATUS.Cancelled)).toBe(false)
    expect(canTransition(ORDER_STATUS.Cancelled, ORDER_STATUS.Done)).toBe(false)
    expect(canTransition(ORDER_STATUS.Cancelled, ORDER_STATUS.Pending)).toBe(false)
    expect(canTransition(ORDER_STATUS.Cancelled, ORDER_STATUS.Cancelled)).toBe(false)
  })
})

describe('regroupement des lignes', () => {
  it('additionne le meme plat ajoute plusieurs fois', () => {
    const lines = mergeLines([
      { dishId: 'a', quantity: 1 },
      { dishId: 'b', quantity: 2 },
      { dishId: 'a', quantity: 3 },
    ])

    expect(lines).toEqual([
      { dishId: 'a', quantity: 4 },
      { dishId: 'b', quantity: 2 },
    ])
  })

  it('conserve l ordre d ajout', () => {
    const lines = mergeLines([
      { dishId: 'dessert', quantity: 1 },
      { dishId: 'plat', quantity: 1 },
    ])

    expect(lines.map((line) => line.dishId)).toEqual(['dessert', 'plat'])
  })

  it('refuse une commande vide', () => {
    expect(() => mergeLines([])).toThrow(EmptyOrderError)
  })

  it('refuse une quantite absurde', () => {
    expect(() => mergeLines([{ dishId: 'a', quantity: 0 }])).toThrow(InvalidQuantityError)
    expect(() => mergeLines([{ dishId: 'a', quantity: -2 }])).toThrow(InvalidQuantityError)
    expect(() => mergeLines([{ dishId: 'a', quantity: 1.5 }])).toThrow(InvalidQuantityError)
    expect(() => mergeLines([{ dishId: 'a', quantity: 100 }])).toThrow(InvalidQuantityError)
  })

  /**
   * Merging can push a dish past the limit even though each line was valid on
   * its own. Without this check after the merge, fifty taps on "+1" would get
   * through at 50, then a hundred at 100.
   */
  it('refuse aussi quand c est le CUMUL qui depasse', () => {
    expect(() =>
      mergeLines([
        { dishId: 'a', quantity: 60 },
        { dishId: 'a', quantity: 60 },
      ])
    ).toThrow(InvalidQuantityError)
  })
})

describe('attente en cuisine', () => {
  const base = new Date('2026-10-01T20:00:00Z')

  it('compte les minutes ecoulees', () => {
    expect(waitingMinutes(base, new Date('2026-10-01T20:07:30Z'))).toBe(7)
  })

  it('ne descend jamais sous zero', () => {
    // Two devices' clocks never agree perfectly: an order "created in the
    // future" must not display -1 min.
    expect(waitingMinutes(base, new Date('2026-10-01T19:59:00Z'))).toBe(0)
  })

  it('monte en urgence par paliers', () => {
    expect(urgency(0)).toBe('calme')
    expect(urgency(7)).toBe('calme')
    expect(urgency(8)).toBe('presse')
    expect(urgency(14)).toBe('presse')
    expect(urgency(15)).toBe('tres_presse')
  })
})

describe('fenetres de l historique', () => {
  const now = new Date('2026-10-09T01:30:00.000Z')

  it('ne connait que trois fenetres', () => {
    expect(isHistoryPeriod('1d')).toBe(true)
    expect(isHistoryPeriod('7d')).toBe(true)
    expect(isHistoryPeriod('30d')).toBe(true)
    expect(isHistoryPeriod('90d')).toBe(false)
  })

  /**
   * Glissante, pas calendaire. A 1h30 du matin le bar est encore dans le
   * service de la veille : une fenetre qui repart a minuit serait vide a
   * l heure exacte ou quelqu un la consulte.
   */
  it('remonte de vingt-quatre heures, pas jusqu a minuit', () => {
    expect(periodStart('1d', now).toISOString()).toBe('2026-10-08T01:30:00.000Z')
  })

  it('compte les jours pleins pour les deux autres', () => {
    expect(periodStart('7d', now).toISOString()).toBe('2026-10-02T01:30:00.000Z')
    expect(periodStart('30d', now).toISOString()).toBe('2026-09-09T01:30:00.000Z')
  })
})
