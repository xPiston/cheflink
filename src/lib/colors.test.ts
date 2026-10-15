import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { locales } from '#/paraglide/runtime'

import { DEFAULT_DISH_COLOR, DISH_COLORS, isDishColor } from './colors'

/**
 * La palette, et les trois endroits qui doivent dire la meme chose.
 *
 * Un token de couleur n est pas qu une constante TypeScript : il est ecrit en
 * clair dans la colonne `dishes.color`, dans le DEFAULT du schema et dans la
 * migration qui a passe au blanc tous les plats deja en place. Renommer le
 * token d un cote laisse les autres pointer sur une valeur qui n existe plus,
 * et rien dans le compilateur ne le voit. Ces tests le voient.
 */

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

describe('palette des plats', () => {
  it('ne reconnait que ses propres tokens', () => {
    expect(isDishColor('blanc')).toBe(true)
    expect(isDishColor('rouge')).toBe(true)
    expect(isDishColor('turquoise')).toBe(false)
    expect(isDishColor('')).toBe(false)
    // Le nom anglais est un piege plausible : la colonne est du texte libre.
    expect(isDishColor('white')).toBe(false)
  })

  it('a le blanc pour defaut', () => {
    expect(DISH_COLORS).toContain(DEFAULT_DISH_COLOR)
    expect(DEFAULT_DISH_COLOR).toBe('blanc')
  })

  it('n a pas deux fois le meme token', () => {
    expect([...new Set(DISH_COLORS)]).toHaveLength(DISH_COLORS.length)
  })
})

describe('accord entre le code et la base', () => {
  it('le DEFAULT du schema est celui du code', () => {
    expect(read('src/db/schema.ts')).toContain(`.default('${DEFAULT_DISH_COLOR}')`)
  })

  /**
   * La migration qui a introduit les couleurs a peint en blanc tous les plats
   * deja en place. Si le token change de nom, cette migration - deja
   * appliquee en production, donc jamais rejouee - laisse des lignes avec une
   * valeur que plus personne ne connait.
   */
  it('la migration a bien ecrit ce token la', () => {
    expect(read('drizzle/0004_dish_colors.sql')).toContain(
      `ALTER TABLE \`dishes\` ADD \`color\` text DEFAULT '${DEFAULT_DISH_COLOR}' NOT NULL`
    )
  })
})

describe('traduction des couleurs', () => {
  it.each(locales)('nomme chaque couleur en %s', (locale) => {
    const catalogue = JSON.parse(read(`messages/${locale}.json`)) as Record<string, unknown>
    const missing = DISH_COLORS.filter((color) => !(`color_${color}` in catalogue))

    // Une couleur sans nom n est pas qu un detail de traduction : c est le
    // libelle accessible de sa pastille dans le selecteur, et sans lui le
    // choix se fait "la troisieme en partant de la gauche".
    expect(missing).toEqual([])
  })
})
