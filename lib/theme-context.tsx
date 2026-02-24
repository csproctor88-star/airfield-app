'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

export type ThemePreference = 'light' | 'dark' | 'auto'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'glidepath_theme'

type ThemeContextValue = {
  theme: ThemePreference
  resolvedTheme: ResolvedTheme
  setTheme: (t: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'auto',
  resolvedTheme: 'dark',
  setTheme: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolve(pref: ThemePreference): ResolvedTheme {
  return pref === 'auto' ? getSystemTheme() : pref
}

function applyTheme(resolved: ResolvedTheme) {
  document.documentElement.setAttribute('data-theme', resolved)
  // Update the theme-color meta tag for the browser chrome
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', resolved === 'dark' ? '#0B1120' : '#F1F5F9')
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(() => {
    if (typeof window === 'undefined') return 'auto'
    return (localStorage.getItem(STORAGE_KEY) as ThemePreference) || 'auto'
  })

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolve(theme))

  const setTheme = useCallback((t: ThemePreference) => {
    setThemeState(t)
    localStorage.setItem(STORAGE_KEY, t)
    const r = resolve(t)
    setResolvedTheme(r)
    applyTheme(r)
  }, [])

  // Apply on mount and listen for system theme changes
  useEffect(() => {
    const saved = (localStorage.getItem(STORAGE_KEY) as ThemePreference) || 'auto'
    setThemeState(saved)
    const r = resolve(saved)
    setResolvedTheme(r)
    applyTheme(r)

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      // Only react to system change if preference is 'auto'
      const current = (localStorage.getItem(STORAGE_KEY) as ThemePreference) || 'auto'
      if (current === 'auto') {
        const next = getSystemTheme()
        setResolvedTheme(next)
        applyTheme(next)
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
