import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { locales } from '#/paraglide/runtime'

import {
  asCustomColor,
  asDishColor,
  CUSTOM_COLOR_SEED,
  DEFAULT_DISH_COLOR,
  DISH_COLORS,
  isDishToken,
} from './colors'

/**
 * La palette, et les endroits qui doivent dire la meme chose.
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
    expect(isDishToken('blanc')).toBe(true)
    expect(isDishToken('marron')).toBe(true)
    expect(isDishToken('')).toBe(false)
    // Le nom anglais est un piege plausible : la colonne est du texte libre.
    expect(isDishToken('white')).toBe(false)
    // Une couleur personnalisee est une couleur valide, mais pas un token.
    expect(isDishToken('#ff8800')).toBe(false)
  })

  it('a le blanc pour defaut', () => {
    expect(DISH_COLORS).toContain(DEFAULT_DISH_COLOR)
    expect(DEFAULT_DISH_COLOR).toBe('blanc')
  })

  it('n a pas deux fois le meme token', () => {
    expect([...new Set(DISH_COLORS)]).toHaveLength(DISH_COLORS.length)
  })

  /**
   * Deux tokens peints de la meme teinte, c est deux couleurs qui ne se
   * distinguent pas sur la carte - et le compilateur ne voit rien, puisque
   * les deux entrees du Record sont bien remplies.
   */
  it('ne peint pas deux tokens de la meme teinte', () => {
    const dots = [...read('src/components/dish-color.tsx').matchAll(/dot: '([^']+)'/g)].map(
      (match) => match[1]
    )

    expect(dots).toHaveLength(DISH_COLORS.length)
    expect([...new Set(dots)]).toHaveLength(dots.length)
  })
})

describe('couleur personnalisee', () => {
  it('accepte un hex a six chiffres', () => {
    expect(asCustomColor('#ff8800')).toBe('#ff8800')
    expect(asCustomColor('#000000')).toBe('#000000')
  })

  /**
   * Normalise, pour que deux plats de la meme couleur portent la meme chaine :
   * `<input type="color">` rend du minuscule, un hex ecrit a la main ne le
   * fait pas, et `#FF8800` vs `#ff8800` serait deux couleurs dans la base pour
   * une seule a l ecran.
   */
  it('met en minuscule et enleve les espaces', () => {
    expect(asCustomColor('#FF8800')).toBe('#ff8800')
    expect(asCustomColor('  #Ff8800 ')).toBe('#ff8800')
  })

  it('refuse tout ce qui n est pas exactement ca', () => {
    // Le raccourci a trois chiffres : accepte par CSS, jamais produit par le
    // selecteur, et il doublerait l ecriture de chaque couleur.
    expect(asCustomColor('#f80')).toBeNull()
    // Huit chiffres, donc une transparence : un plat a demi efface sur une
    // carte n est pas une couleur de plat.
    expect(asCustomColor('#ff8800ff')).toBeNull()
    expect(asCustomColor('#ff88zz')).toBeNull()
    expect(asCustomColor('ff8800')).toBeNull()
    expect(asCustomColor('rgb(255,136,0)')).toBeNull()
    expect(asCustomColor('red')).toBeNull()
    expect(asCustomColor('')).toBeNull()
  })

  it('la couleur de depart du selecteur en est une', () => {
    expect(asCustomColor(CUSTOM_COLOR_SEED)).toBe(CUSTOM_COLOR_SEED)
    expect(isDishToken(CUSTOM_COLOR_SEED)).toBe(false)
  })
})

describe('lecture de la colonne', () => {
  it('rend le token ou le hex, et rien d autre', () => {
    expect(asDishColor('blanc')).toBe('blanc')
    expect(asDishColor('turquoise')).toBe('turquoise')
    expect(asDishColor('#FF8800')).toBe('#ff8800')
    expect(asDishColor('white')).toBeNull()
    expect(asDishColor('bg-red-500')).toBeNull()
    expect(asDishColor('')).toBeNull()
  })

  /**
   * Le defaut doit rester une valeur que la lecture reconnait : c est celui
   * que `toDish` applique quand la colonne contient autre chose.
   */
  it('reconnait son propre defaut', () => {
    expect(asDishColor(DEFAULT_DISH_COLOR)).toBe(DEFAULT_DISH_COLOR)
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
    const keys = [
      ...DISH_COLORS.map((color) => `color_${color}`),
      'color_custom',
      'color_custom_named',
    ]
    const missing = keys.filter((key) => !(key in catalogue))

    // Une couleur sans nom n est pas qu un detail de traduction : c est le
    // libelle accessible de sa pastille dans le selecteur, et sans lui le
    // choix se fait "la troisieme en partant de la gauche".
    expect(missing).toEqual([])
  })
})
