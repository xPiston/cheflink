import { useCallback, useEffect, useState } from 'react'

/**
 * Le theme clair ou sombre, propriete de l'APPAREIL.
 *
 * Meme logique que le mode bar/cuisine (voir src/lib/mode.ts) : la tablette de
 * la cuisine et le poste du comptoir ne sont pas dans la meme lumiere, et c'est
 * l'ecran qui doit s'en souvenir, pas le compte. D'ou `localStorage`.
 *
 * Le defaut reste le sombre : la cuisine est souvent dans un coin peu eclaire,
 * et un fond blanc en plein service de soir est agressif. Qui prefere le clair
 * le dit une fois, et l'appareil s'en souvient.
 */
export const THEMES = ['clair', 'sombre'] as const
export type Theme = (typeof THEMES)[number]

export const THEME_STORAGE_KEY = 'cheflink.theme'
export const DEFAULT_THEME: Theme = 'sombre'

export function isTheme(value: unknown): value is Theme {
  return value === 'clair' || value === 'sombre'
}

/** La couleur de la barre du navigateur sur mobile, par theme. */
const THEME_COLOR: Record<Theme, string> = { sombre: '#0a0a0a', clair: '#ffffff' }

/**
 * Applique le theme au document.
 *
 * Trois choses, pas une :
 *   - la classe `dark`, que lit la feuille de style ;
 *   - `colorScheme`, sans quoi les elements rendus par le navigateur lui-meme
 *     - barres de defilement, menus natifs, champs de date - resteraient clairs
 *     sur un fond sombre ;
 *   - la meta `theme-color`, qui teinte la barre du navigateur sur mobile et
 *     jurerait a rester figee sur une seule des deux valeurs.
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement

  root.classList.toggle('dark', theme === 'sombre')
  root.style.colorScheme = theme === 'sombre' ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
}

/**
 * Le script pose dans le <head>, avant tout rendu.
 *
 * Il DOIT etre synchrone et en ligne : si l'application attendait React pour
 * appliquer le theme, un appareil regle sur "clair" afficherait d'abord la page
 * sombre rendue par le serveur, puis basculerait - le fameux flash blanc, mais
 * a l'envers. Ici le document est corrige avant le premier affichage.
 *
 * Il est ecrit a la main plutot que genere depuis `applyTheme` : ce code part
 * dans le HTML sous forme de chaine, il ne peut pas etre un import.
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
if(t!=='clair'&&t!=='sombre'){t=${JSON.stringify(DEFAULT_THEME)}}
var d=t==='sombre';
document.documentElement.classList.toggle('dark',d);
document.documentElement.style.colorScheme=d?'dark':'light';
var m=document.querySelector('meta[name="theme-color"]');
if(m){m.setAttribute('content',d?${JSON.stringify(THEME_COLOR.sombre)}:${JSON.stringify(THEME_COLOR.clair)})}
}catch(e){}})();`

export function useTheme(): [Theme, (theme: Theme) => void] {
  /**
   * On part du defaut cote serveur : `localStorage` n'y existe pas, et lire une
   * autre valeur au premier rendu creerait un ecart entre le HTML du serveur et
   * celui du client. Le script ci-dessus a deja mis le document d'accord ; cet
   * effet ne fait que rattraper l'etat React.
   */
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
      if (isTheme(stored)) {
        setThemeState(stored)
      }
    } catch {
      // Navigation privee ou stockage bloque : le defaut fait l'affaire.
    }
  }, [])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    applyTheme(next)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Idem : ne pas perdre le changement pour autant.
    }
  }, [])

  return [theme, setTheme]
}
