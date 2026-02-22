'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

type Advisory = {
  type: 'INFO' | 'CAUTION' | 'WARNING'
  text: string
}

type DashboardState = {
  advisory: Advisory | null
  setAdvisory: (a: Advisory | null) => void
  activeRunway: '01' | '19'
  setActiveRunway: (r: '01' | '19') => void
  runwayStatus: 'open' | 'suspended' | 'closed'
  setRunwayStatus: (s: 'open' | 'suspended' | 'closed') => void
}

const DashboardContext = createContext<DashboardState | null>(null)

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [advisory, setAdvisory] = useState<Advisory | null>(null)
  const [activeRunway, setActiveRunway] = useState<'01' | '19'>('01')
  const [runwayStatus, setRunwayStatus] = useState<'open' | 'suspended' | 'closed'>('open')

  return (
    <DashboardContext.Provider
      value={{ advisory, setAdvisory, activeRunway, setActiveRunway, runwayStatus, setRunwayStatus }}
    >
      {children}
    </DashboardContext.Provider>
  )
}

export function useDashboard() {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider')
  return ctx
}
