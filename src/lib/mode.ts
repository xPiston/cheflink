import { useCallback, useEffect, useState } from 'react'

/**
 * Le mode de l'appareil : bar ou cuisine.
 *
 * C'est une propriete de l'ECRAN, pas du compte - la tablette de la cuisine
 * reste en mode cuisine, le poste du comptoir en mode bar, et le meme compte
 * sert aux deux. D'ou le stockage dans `localStorage` plutot qu'en base.
 *
 * Le mode choisi decide juste de l'ecran d'accueil et de la navigation ; il
 * n'autorise rien de plus, puisqu'il suffit d'un clic pour en changer.
 */
export const MODES = ['bar', 'cuisine'] as const
export type Mode = (typeof MODES)[number]

const STORAGE_KEY = 'cheflink.mode'

export function isMode(value: unknown): value is Mode {
  return typeof value === 'string' && (MODES as ReadonlyArray<string>).includes(value)
}

export function useMode(): [Mode, (mode: Mode) => void] {
  /**
   * On demarre toujours sur 'bar', meme si localStorage dit autre chose : le
   * serveur rend la page sans acces au stockage du navigateur, et lire la vraie
   * valeur des le premier rendu produirait un ecart entre HTML serveur et HTML
   * client. On la lit donc apres le montage.
   */
  const [mode, setModeState] = useState<Mode>('bar')

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (isMode(stored)) {
        setModeState(stored)
      }
    } catch {
      // Navigation privee ou stockage bloque : le mode par defaut fait l'affaire.
    }
  }, [])

  const setMode = useCallback((next: Mode) => {
    setModeState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Idem : ne pas perdre le changement de mode pour autant.
    }
  }, [])

  return [mode, setMode]
}
