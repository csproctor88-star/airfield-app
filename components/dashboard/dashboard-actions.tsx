'use client'
import { createContext, useContext } from 'react'

/** Board-level actions a widget can trigger (provided by the dashboard page). */
export type DashboardActions = {
  /** Append one Airfield Lighting widget per area to the current board. */
  addLightingAreas?: () => void
}

const DashboardActionsContext = createContext<DashboardActions>({})

export const DashboardActionsProvider = DashboardActionsContext.Provider

export function useDashboardActions(): DashboardActions {
  return useContext(DashboardActionsContext)
}
