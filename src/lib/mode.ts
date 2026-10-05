import { useCallback, useEffect, useState } from 'react'

/**
 * The device's mode: bar or kitchen.
 *
 * This belongs to the SCREEN, not to the account - the kitchen tablet stays in
 * kitchen mode, the counter station in bar mode, and one account serves both.
 * Hence `localStorage` rather than a column in the database.
 *
 * The mode only decides the landing screen and the navigation; it grants
 * nothing, since one click changes it.
 */
export const MODES = ['bar', 'cuisine'] as const
export type Mode = (typeof MODES)[number]

const STORAGE_KEY = 'cheflink.mode'

export function isMode(value: unknown): value is Mode {
  return typeof value === 'string' && (MODES as ReadonlyArray<string>).includes(value)
}

export function useMode(): [Mode, (mode: Mode) => void] {
  /**
   * We always start on 'bar', even if localStorage says otherwise: the server
   * renders the page with no access to browser storage, and reading the real
   * value on the first render would produce a mismatch between the server's
   * HTML and the client's. So we read it after mount.
   */
  const [mode, setModeState] = useState<Mode>('bar')

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (isMode(stored)) {
        setModeState(stored)
      }
    } catch {
      // Private browsing or blocked storage: the default mode will do.
    }
  }, [])

  const setMode = useCallback((next: Mode) => {
    setModeState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Same: don't lose the mode change over it.
    }
  }, [])

  return [mode, setMode]
}
