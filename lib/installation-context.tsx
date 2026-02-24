'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { Installation, InstallationRunway, UserRole } from '@/lib/supabase/types'
import { fetchInstallation, fetchInstallationRunways, fetchInstallationAreas, getUserPrimaryInstallationId, fetchInstallations, fetchUserInstallations } from '@/lib/supabase/installations'
import { createClient } from '@/lib/supabase/client'

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
  /** Remove an installation from the user's list */
  removeInstallation: (baseId: string) => Promise<boolean>
  /** Current user's role */
  userRole: UserRole | null
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
  const [userRole, setUserRole] = useState<UserRole | null>(null)
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
    const areaNames = installationAreas.map(a => a.area_name)
    setAreas(areaNames)
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

  // Roles that can switch between installations
  const MULTI_INSTALL_ROLES: UserRole[] = ['airfield_manager', 'sys_admin']

  // Remove an installation from the user's list (delete base_members entry)
  const removeInstallation = useCallback(async (baseId: string): Promise<boolean> => {
    const supabase = createClient()
    if (!supabase) return false

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return false

      const res = await fetch('/api/installations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseId, userId: user.id }),
      })

      if (!res.ok) return false

      // Update local state
      setAllInstallations(prev => prev.filter(inst => inst.id !== baseId))
      return true
    } catch {
      return false
    }
  }, [])

  // Initial load
  useEffect(() => {
    async function init() {
      // Load user role from profile
      let role: UserRole | null = null
      const supabase = createClient()
      if (supabase) {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', user.id)
              .single()
            if (profile?.role) role = profile.role as UserRole
          }
        } catch {
          // No auth — keep null
        }
      }
      setUserRole(role)

      // Fetch installations the user is a member of (for privileged roles)
      if (role && MULTI_INSTALL_ROLES.includes(role)) {
        const userInstallations = await fetchUserInstallations()
        setAllInstallations(userInstallations)
      }

      // Determine which installation to load
      let primaryId = await getUserPrimaryInstallationId()

      // Fallback: use first available installation
      if (!primaryId) {
        const installations = await fetchInstallations()
        if (installations.length > 0) primaryId = installations[0].id
      }

      if (primaryId) {
        setInstallationId(primaryId)
        await loadInstallationConfig(primaryId)
      }
      setLoaded(true)
    }

    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadInstallationConfig])

  // Don't render children until initial load completes
  if (!loaded) return null

  return (
    <InstallationContext.Provider
      value={{ currentInstallation, installationId, allInstallations, runways, areas, ceShops, switchInstallation, removeInstallation, userRole, loaded }}
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
