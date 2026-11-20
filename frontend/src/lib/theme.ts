import { useCallback, useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'
const KEY = 'metabolc_theme'
const EVENT = 'metabolc:theme'

export const getTheme = (): Theme => {
  try { return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark' } catch { return 'dark' }
}

/** Routes already migrated to design tokens. Every other page still has its
 *  dark colours hardcoded, so it is always rendered dark until it is migrated;
 *  add its path here when it is. */
export const isThemedRoute = (pathname: string) =>
  pathname === '/methods' || pathname === '/compounds' || pathname === '/compare' || pathname === '/tools/interference' || pathname === '/panel-builder' || pathname === '/tools/unit-converter' || pathname === '/tools/method-transfer' || pathname === '/tools/mass-calculator' || pathname === '/tools/dilution-calculator' || pathname === '/tools/matrix-effect' || pathname === '/submit' || pathname === '/review' || pathname === '/verification' || pathname === '/validation' || pathname === '/modules' || pathname === '/validation/sample-dossier' || pathname === '/validation/plan' || /^\/method\/\d+\/?$/.test(pathname)

export const applyTheme = (pathname: string) => {
  const dark = getTheme() === 'dark' || !isThemedRoute(pathname)
  document.documentElement.classList.toggle('dark', dark)
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getTheme)
  useEffect(() => {
    const sync = () => setThemeState(getTheme())
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener('storage', sync) }
  }, [])
  const setTheme = useCallback((next: Theme) => {
    try { localStorage.setItem(KEY, next) } catch { /* private mode: theme lasts for this tab only */ }
    setThemeState(next)
    window.dispatchEvent(new Event(EVENT))
  }, [])
  return { theme, setTheme, toggle: () => setTheme(theme === 'dark' ? 'light' : 'dark') }
}
