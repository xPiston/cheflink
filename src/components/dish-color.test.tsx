import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { CUSTOM_COLOR_SEED, DISH_COLORS } from '#/lib/colors'
import { m } from '#/paraglide/messages'

import { DishColorPicker, DishDot, colorName, dishBar } from './dish-color'

/**
 * Le rendu des couleurs, rendu pour de vrai.
 *
 * Une couleur de la palette sort en classes Tailwind, une couleur
 * personnalisee en style inline - deux chemins, et c est tout l interet de
 * les verifier ici : une classe `bg-[#7c3aed]` compilerait sans rien peindre,
 * puisque Tailwind ne genere que ce qu il lit dans le fichier source.
 *
 * `renderToStaticMarkup` plutot qu un vrai DOM : il n y a ni jsdom ni
 * testing-library dans ce projet, et le markup suffit a dire si la couleur
 * part a l ecran et comment elle est annoncee.
 */

const CUSTOM = '#7c3aed'

describe('la pastille', () => {
  it('peint un token avec ses classes, sans style inline', () => {
    const markup = renderToStaticMarkup(<DishDot color="marron" />)

    expect(markup).toContain('bg-amber-800')
    expect(markup).not.toContain('style=')
  })

  it('peint une couleur personnalisee en style inline', () => {
    const markup = renderToStaticMarkup(<DishDot color={CUSTOM} />)

    expect(markup).toContain(`background-color:${CUSTOM}`)
    // Le liseré : sans lui, un blanc casse choisi a la main disparait sur une
    // carte blanche.
    expect(markup).toContain('ring-1')
  })
})

describe('la barre du comptoir', () => {
  it('garde les quatre pixels dans les deux cas', () => {
    expect(dishBar('rouge').className).toContain('border-l-4')
    expect(dishBar(CUSTOM).className).toContain('border-l-4')
  })

  it('colore par classe pour un token, par style pour une personnalisee', () => {
    expect(dishBar('rouge')).toEqual({ className: 'border-l-4 border-l-red-500', style: undefined })
    expect(dishBar(CUSTOM).style).toEqual({ borderLeftColor: CUSTOM })
  })
})

describe('le nom annonce', () => {
  it('nomme un token et recite une personnalisee', () => {
    expect(colorName('jade')).toBe(m.color_jade())
    expect(colorName(CUSTOM)).toContain(CUSTOM)
  })
})

describe('le selecteur', () => {
  const render = (value: Parameters<typeof colorName>[0]) =>
    renderToStaticMarkup(<DishColorPicker value={value} onChange={() => {}} />)

  it('offre la palette entiere plus le choix libre', () => {
    const markup = render('blanc')

    expect(markup.match(/role="radio"/g)).toHaveLength(DISH_COLORS.length + 1)
    // Une seule case cochee, sinon le lecteur d ecran annonce deux couleurs.
    expect(markup.match(/aria-checked="true"/g)).toHaveLength(1)
  })

  it('part de la palette quand le plat porte un token', () => {
    const markup = render('vert')

    expect(markup).toContain(`aria-label="${m.color_vert()}"`)
    // La pastille libre montre l arc-en-ciel, et le selecteur natif s ouvre
    // sur la couleur de depart.
    expect(markup).toContain('conic-gradient')
    expect(markup).toContain(`value="${CUSTOM_COLOR_SEED}"`)
    expect(markup).toContain(`aria-label="${m.color_custom()}"`)
  })

  it('coche la pastille libre et affiche le hex quand la couleur est a la maison', () => {
    const markup = render(CUSTOM)

    expect(markup).toContain(`background-color:${CUSTOM}`)
    expect(markup).toContain(`value="${CUSTOM}"`)
    // Ecrit en clair : une couleur choisie il y a six mois est impossible a
    // nommer de memoire.
    expect(markup).toContain(`>${CUSTOM}</p>`)
    expect(markup).not.toContain('conic-gradient')
    expect(markup.match(/aria-checked="true"/g)).toHaveLength(1)
  })

  it('n ouvre pas le selecteur natif a la souris quand tout est desactive', () => {
    const markup = renderToStaticMarkup(
      <DishColorPicker value="blanc" onChange={() => {}} disabled />
    )

    // Dix-sept boutons et l input cache : aucun ne doit rester cliquable
    // pendant l enregistrement.
    expect(markup.match(/disabled=""/g)).toHaveLength(DISH_COLORS.length + 2)
  })
})
