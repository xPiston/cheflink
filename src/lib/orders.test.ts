import { describe, expect, it } from 'vitest'

import {
  EmptyOrderError,
  InvalidQuantityError,
  ORDER_STATUS,
  canTransition,
  isOrderStatus,
  mergeLines,
  urgency,
  waitingMinutes,
} from './orders'

/**
 * Les regles d'une commande, testees sans base, sans serveur et sans navigateur.
 *
 * C'est tout l'interet d'avoir sorti ces fonctions des composants et des
 * requetes : la machine a etats et le regroupement des lignes sont verifiables
 * en quelques millisecondes.
 */

describe('machine a etats', () => {
  it('ne connait que deux etats', () => {
    expect(isOrderStatus('en_attente')).toBe(true)
    expect(isOrderStatus('terminee')).toBe(true)
    expect(isOrderStatus('en_cours')).toBe(false)
  })

  it('va de en_attente a terminee, et pas en arriere', () => {
    expect(canTransition(ORDER_STATUS.Pending, ORDER_STATUS.Done)).toBe(true)
    expect(canTransition(ORDER_STATUS.Done, ORDER_STATUS.Pending)).toBe(false)
    expect(canTransition(ORDER_STATUS.Done, ORDER_STATUS.Done)).toBe(false)
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
   * Le regroupement peut faire franchir la limite a un plat qui, ligne par
   * ligne, etait valide. Sans cette verification apres fusion, cinquante
   * clics sur "+1" passeraient a 50, puis cent a 100.
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
    // Les horloges de deux appareils ne sont jamais parfaitement d'accord :
    // une commande "creee dans le futur" ne doit pas afficher -1 min.
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
