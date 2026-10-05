import { useCallback, useEffect, useState } from 'react'

/**
 * Light or dark theme, a property of the DEVICE.
 *
 * Same reasoning as the bar/kitchen mode (see src/lib/mode.ts): the kitchen
 * tablet and the counter station are not under the same light, and it is the
 * screen that should remember, not the account. Hence `localStorage`.
 *
 * Dark stays the default: a kitchen is often a dim corner, and a white
 * background mid-evening is harsh. Anyone who prefers light says so once, and
 * the device remembers.
 *
 * The two values are French because they are what sits in `localStorage` on
 * devices already in service; renaming them would reset everyone's choice.
 */
export const THEMES = ['clair', 'sombre'] as const
export type Theme = (typeof THEMES)[number]

export const THEME_STORAGE_KEY = 'cheflink.theme'
export const DEFAULT_THEME: Theme = 'sombre'

export function isTheme(value: unknown): value is Theme {
  return value === 'clair' || value === 'sombre'
}

/** The mobile browser bar colour, per theme. */
const THEME_COLOR: Record<Theme, string> = { sombre: '#0a0a0a', clair: '#ffffff' }

/**
 * Applies the theme to the document.
 *
 * Three things, not one:
 *   - the `dark` class, which the stylesheet reads;
 *   - `colorScheme`, without which the elements the browser draws itself
 *     - scrollbars, native menus, date pickers - would stay light on a dark
 *     background;
 *   - the `theme-color` meta, which tints the browser bar on mobile and would
 *     clash if it stayed frozen on one of the two values.
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement

  root.classList.toggle('dark', theme === 'sombre')
  root.style.colorScheme = theme === 'sombre' ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
}

/**
 * The script placed in the <head>, before anything renders.
 *
 * It MUST be synchronous and inline. If the app waited for React to apply the
 * theme, a device set to light would first show the dark page rendered by the
 * server and then switch - the classic white flash, backwards. Here the
 * document is corrected before the first paint.
 *
 * It is written by hand rather than generated from `applyTheme`: this code
 * ships inside the HTML as a string, so it cannot be an import.
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
   * We start from the default on the server: `localStorage` does not exist
   * there, and reading another value on the first render would create a gap
   * between the server's HTML and the client's. The script above has already
   * brought the document in line; this effect only catches React's state up.
   */
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
      if (isTheme(stored)) {
        setThemeState(stored)
      }
    } catch {
      // Private browsing or blocked storage: the default will do.
    }
  }, [])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    applyTheme(next)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Same: don't lose the change over it.
    }
  }, [])

  return [theme, setTheme]
}
