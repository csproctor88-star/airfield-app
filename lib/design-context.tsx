'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

// Opt-in "v2" visual design (readability + hierarchy refresh). Non-destructive:
// when active, `data-design="v2"` on <html> switches the typography, contrast,
// and neutral-border token overrides in globals.css and opts pilot components
// into their v2 styling. Mirrors lib/theme-context.tsx. The flash-prevention
// script in app/layout.tsx sets the attribute pre-hydration.

export type DesignVersion = 'v1' | 'v2'

const STORAGE_KEY = 'glidepath_design'

type DesignContextValue = {
  design: DesignVersion
  setDesign: (d: DesignVersion) => void
}

const DesignContext = createContext<DesignContextValue>({
  design: 'v1',
  setDesign: () => {},
})

export function useDesign() {
  return useContext(DesignContext)
}

function applyDesign(d: DesignVersion) {
  if (d === 'v2') document.documentElement.setAttribute('data-design', 'v2')
  else document.documentElement.removeAttribute('data-design')
}

export function DesignProvider({ children }: { children: React.ReactNode }) {
  const [design, setDesignState] = useState<DesignVersion>(() => {
    if (typeof window === 'undefined') return 'v1'
    return localStorage.getItem(STORAGE_KEY) === 'v2' ? 'v2' : 'v1'
  })

  const setDesign = useCallback((d: DesignVersion) => {
    setDesignState(d)
    localStorage.setItem(STORAGE_KEY, d)
    applyDesign(d)
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) === 'v2' ? 'v2' : 'v1'
    setDesignState(saved)
    applyDesign(saved)
  }, [])

  return (
    <DesignContext.Provider value={{ design, setDesign }}>
      {children}
    </DesignContext.Provider>
  )
}
