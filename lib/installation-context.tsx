'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { Installation, InstallationRunway } from '@/lib/supabase/types'
import { fetchInstallation, fetchInstallationRunways, fetchInstallationAreas, getUserPrimaryInstallationId, fetchInstallations } from '@/lib/supabase/installations'
import { createClient } from '@/lib/supabase/client'

// Selfridge fallback ID (used when DB not available / demo mode)
const SELFRIDGE_INSTALLATION_ID = '00000000-0000-0000-0000-000000000001'

export interface InstallationContextValue {
  /** Current active installation (null while loading) */
  currentInstallation: Installation | null
  /** Current installation ID (available before full installation loads) */
  installationId: string | null
  /** All installations the user has access to */
  allInstallations: Installation[]
  /** Runways for the current installation */
  runways: InstallationRunway[]
  /** Airfield areas for the current installation */
  areas: string[]
  /** CE shops for the current installation */
  ceShops: string[]
  /** Switch to a different installation */
  switchInstallation: (installationId: string) => Promise<void>
  /** Whether the context has finished initial loading */
  loaded: boolean
}

const InstallationContext = createContext<InstallationContextValue | null>(null)

export function InstallationProvider({ children }: { children: ReactNode }) {
  const [currentInstallation, setCurrentInstallation] = useState<Installation | null>(null)
  const [installationId, setInstallationId] = useState<string | null>(null)
  const [allInstallations, setAllInstallations] = useState<Installation[]>([])
  const [runways, setRunways] = useState<InstallationRunway[]>([])
  const [areas, setAreas] = useState<string[]>([])
  const [ceShops, setCeShops] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)

  // Load a specific installation's configuration
  const loadInstallationConfig = useCallback(async (id: string) => {
    const [installation, installationRunways, installationAreas] = await Promise.all([
      fetchInstallation(id),
      fetchInstallationRunways(id),
      fetchInstallationAreas(id),
    ])

    if (installation) {
      setCurrentInstallation(installation)
      setInstallationId(installation.id)
      setCeShops(installation.ce_shops || [])
    }
    setRunways(installationRunways)
    setAreas(installationAreas.map(a => a.area_name))
  }, [])

  // Switch to a different installation and persist the choice
  const switchInstallation = useCallback(async (newInstallationId: string) => {
    setInstallationId(newInstallationId)
    await loadInstallationConfig(newInstallationId)

    // Persist choice to profile
    const supabase = createClient()
    if (supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await supabase
            .from('profiles')
            .update({ primary_base_id: newInstallationId })
            .eq('id', user.id)
        }
      } catch {
        // Non-critical — user can re-select
      }
    }
  }, [loadInstallationConfig])

  // Initial load
  useEffect(() => {
    async function init() {
      // Fetch all available installations
      const installations = await fetchInstallations()
      setAllInstallations(installations)

      // Determine which installation to load
      let primaryId = await getUserPrimaryInstallationId()

      // Fallback: use Selfridge if no primary set, or first available installation
      if (!primaryId) {
        primaryId = installations.length > 0 ? installations[0].id : SELFRIDGE_INSTALLATION_ID
      }

      setInstallationId(primaryId)
      await loadInstallationConfig(primaryId)
      setLoaded(true)
    }

    init()
  }, [loadInstallationConfig])

  // Don't render children until initial load completes
  if (!loaded) return null

  return (
    <InstallationContext.Provider
      value={{ currentInstallation, installationId, allInstallations, runways, areas, ceShops, switchInstallation, loaded }}
    >
      {children}
    </InstallationContext.Provider>
  )
}

export function useInstallation() {
  const ctx = useContext(InstallationContext)
  if (!ctx) throw new Error('useInstallation must be used within InstallationProvider')
  return ctx
}
