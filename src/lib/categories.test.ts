import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { locales } from '#/paraglide/runtime'

import { CATEGORY_COLORS, DEFAULT_CATEGORY_COLOR, isCategoryColor } from './categories'

/**
 * La palette, et les trois endroits qui doivent dire la meme chose.
 *
 * Un token de couleur n est pas qu une constante TypeScript : il est ecrit en
 * clair dans la colonne `color`, dans le DEFAULT du schema et dans la
 * migration qui a tout passe au blanc. Renommer le token d un cote laisse les
 * autres pointer sur une valeur qui n existe plus, et rien dans le compilateur
 * ne le voit. Ces tests le voient.
 */

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

describe('palette des categories', () => {
  it('ne reconnait que ses propres tokens', () => {
    expect(isCategoryColor('blanc')).toBe(true)
    expect(isCategoryColor('rouge')).toBe(true)
    expect(isCategoryColor('turquoise')).toBe(false)
    expect(isCategoryColor('')).toBe(false)
    // Le nom anglais est un piege plausible : la colonne est du texte libre.
    expect(isCategoryColor('white')).toBe(false)
  })

  it('a le blanc pour defaut', () => {
    expect(CATEGORY_COLORS).toContain(DEFAULT_CATEGORY_COLOR)
    expect(DEFAULT_CATEGORY_COLOR).toBe('blanc')
  })

  it('n a pas deux fois le meme token', () => {
    expect([...new Set(CATEGORY_COLORS)]).toHaveLength(CATEGORY_COLORS.length)
  })
})

describe('accord entre le code et la base', () => {
  it('le DEFAULT du schema est celui du code', () => {
    expect(read('src/db/schema.ts')).toContain(`.default('${DEFAULT_CATEGORY_COLOR}')`)
  })

  /**
   * La migration qui a introduit les couleurs a peint toutes les categories
   * existantes en blanc. Si le token change de nom, cette migration - deja
   * appliquee en production, donc jamais rejouee - laisse des lignes avec une
   * valeur que plus personne ne connait.
   */
  it('la migration a bien ecrit ce token la', () => {
    const migration = read('drizzle/0003_category_colors.sql')

    expect(migration).toContain(`DEFAULT '${DEFAULT_CATEGORY_COLOR}'`)
    expect(migration).toContain(`'${DEFAULT_CATEGORY_COLOR}',\n\tunixepoch() * 1000`)
  })
})

describe('traduction des couleurs', () => {
  it.each(locales)('nomme chaque couleur en %s', (locale) => {
    const catalogue = JSON.parse(read(`messages/${locale}.json`)) as Record<string, unknown>
    const missing = CATEGORY_COLORS.filter((color) => !(`color_${color}` in catalogue))

    // Une couleur sans nom n est pas qu un detail de traduction : c est le
    // libelle accessible de sa pastille dans le selecteur, et sans lui le
    // choix se fait "la troisieme en partant de la gauche".
    expect(missing).toEqual([])
  })
})
