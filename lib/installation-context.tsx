'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { Installation, InstallationRunway, UserRole } from '@/lib/supabase/types'
import { fetchInstallation, fetchInstallationRunways, fetchInstallationAreas, fetchInstallationArffAircraft, getUserPrimaryInstallationId, fetchInstallations, fetchUserInstallations } from '@/lib/supabase/installations'
import { fetchFacilities, type FacilityRow } from '@/lib/supabase/facilities'
import { createClient } from '@/lib/supabase/client'
import type { ModuleKey, SetupProgress, SetupStepStatus, WizardStepKey } from '@/lib/modules-config'
import { ALL_TOGGLEABLE_MODULES } from '@/lib/modules-config'

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
  /** Discrepancy type → CE shop mapping for the current installation */
  typeShopMap: Record<string, string>
  /** ARFF aircraft configured for the current installation */
  arffAircraft: string[]
  /** Facility numbers configured for the current installation */
  facilities: FacilityRow[]
  /** Switch to a different installation */
  switchInstallation: (installationId: string) => Promise<void>
  /** Refetch the current installation row (e.g., after an in-place config change) */
  refreshCurrentInstallation: () => Promise<void>
  /** Remove an installation from the user's list */
  removeInstallation: (baseId: string) => Promise<boolean>
  /** Current user's role */
  userRole: UserRole | null
  /** Default email for PDF sending */
  defaultPdfEmail: string | null
  /** Update default PDF email */
  updateDefaultPdfEmail: (email: string | null) => Promise<void>
  /** Per-base default Out of Office message */
  defaultOooMessage: string | null
  /** Save a new per-base default Out of Office message */
  updateDefaultOooMessage: (message: string) => Promise<void>
  /** Per-base default "closed for the day" message */
  defaultClosedMessage: string | null
  /** Save a new per-base default closed message */
  updateDefaultClosedMessage: (message: string) => Promise<void>
  /** Module keys enabled for the current installation */
  enabledModules: ModuleKey[]
  /** Per-step setup completion state for the current installation */
  setupProgress: SetupProgress
  /** Persist a new enabled-modules list for the current installation */
  updateEnabledModules: (keys: ModuleKey[]) => Promise<void>
  /** Mark a setup step as complete or skipped, attributing to the current user */
  markSetupStep: (step: WizardStepKey, status: SetupStepStatus) => Promise<void>
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
  const [typeShopMap, setTypeShopMap] = useState<Record<string, string>>({})
  const [arffAircraft, setArffAircraft] = useState<string[]>([])
  const [facilities, setFacilities] = useState<FacilityRow[]>([])
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [defaultPdfEmail, setDefaultPdfEmail] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  // Load a specific installation's configuration
  const loadInstallationConfig = useCallback(async (id: string) => {
    const [installation, installationRunways, installationAreas, installationArffAircraft, installationFacilities] = await Promise.all([
      fetchInstallation(id),
      fetchInstallationRunways(id),
      fetchInstallationAreas(id),
      fetchInstallationArffAircraft(id),
      fetchFacilities(id),
    ])

    if (installation) {
      setCurrentInstallation(installation)
      setInstallationId(installation.id)
      setCeShops(installation.ce_shops || [])
      setTypeShopMap((installation as unknown as { discrepancy_type_shop_map?: Record<string, string> }).discrepancy_type_shop_map || {})
    }
    setRunways(installationRunways)
    const areaNames = installationAreas.map(a => a.area_name)
    setAreas(areaNames)
    setArffAircraft(installationArffAircraft.map(a => a.aircraft_name))
    setFacilities(installationFacilities)
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

  const refreshCurrentInstallation = useCallback(async () => {
    if (!installationId) return
    await loadInstallationConfig(installationId)
  }, [installationId, loadInstallationConfig])

  // Roles that can switch between installations
  const MULTI_INSTALL_ROLES: UserRole[] = ['airfield_manager', 'sys_admin', 'base_admin', 'namo', 'majcom_rfm']

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

  const defaultOooMessage =
    (currentInstallation as unknown as { default_ooo_message?: string | null } | null)?.default_ooo_message ?? null

  const updateDefaultOooMessage = useCallback(async (message: string) => {
    if (!installationId) return
    const supabase = createClient()
    if (!supabase) return
    await supabase
      .from('bases')
      .update({ default_ooo_message: message } as Record<string, unknown>)
      .eq('id', installationId)
    setCurrentInstallation(prev =>
      prev ? ({ ...prev, default_ooo_message: message } as typeof prev) : prev
    )
  }, [installationId])

  const defaultClosedMessage =
    (currentInstallation as unknown as { default_closed_message?: string | null } | null)?.default_closed_message ?? null

  const updateDefaultClosedMessage = useCallback(async (message: string) => {
    if (!installationId) return
    const supabase = createClient()
    if (!supabase) return
    await supabase
      .from('bases')
      .update({ default_closed_message: message } as Record<string, unknown>)
      .eq('id', installationId)
    setCurrentInstallation(prev =>
      prev ? ({ ...prev, default_closed_message: message } as typeof prev) : prev
    )
  }, [installationId])

  // Derived from currentInstallation. If the column is missing (migration not
  // applied yet, or fetch returned undefined), fall back to all toggleables so
  // the UI is functional. But ALWAYS trust an explicit array — including an
  // empty one — because that represents a deliberate admin choice.
  const enabledModules: ModuleKey[] = (() => {
    const raw = (currentInstallation as unknown as { enabled_modules?: string[] } | null)?.enabled_modules
    if (Array.isArray(raw)) return raw as ModuleKey[]
    return ALL_TOGGLEABLE_MODULES
  })()

  const setupProgress: SetupProgress =
    ((currentInstallation as unknown as { setup_progress?: SetupProgress } | null)?.setup_progress) ?? {}

  const updateEnabledModules = useCallback(async (keys: ModuleKey[]) => {
    if (!installationId) return
    const supabase = createClient()
    if (!supabase) return
    const unique = Array.from(new Set(keys))
    const { error } = await supabase
      .from('bases')
      .update({ enabled_modules: unique } as Record<string, unknown>)
      .eq('id', installationId)
    if (error) {
      console.error('[installation-context] failed to save enabled_modules:', error.message)
      throw new Error(error.message)
    }
    setCurrentInstallation(prev =>
      prev ? ({ ...prev, enabled_modules: unique } as typeof prev) : prev
    )
  }, [installationId])

  const markSetupStep = useCallback(async (step: WizardStepKey, status: SetupStepStatus) => {
    if (!installationId) return
    const supabase = createClient()
    if (!supabase) return
    let userId: string | undefined
    try {
      const { data: { user } } = await supabase.auth.getUser()
      userId = user?.id
    } catch { /* anonymous — skip attribution */ }
    const prior: SetupProgress =
      ((currentInstallation as unknown as { setup_progress?: SetupProgress } | null)?.setup_progress) ?? {}
    const next: SetupProgress = {
      ...prior,
      [step]: {
        status,
        completed_at: new Date().toISOString(),
        ...(userId ? { completed_by: userId } : {}),
      },
    }
    await supabase
      .from('bases')
      .update({ setup_progress: next } as Record<string, unknown>)
      .eq('id', installationId)
    setCurrentInstallation(prev =>
      prev ? ({ ...prev, setup_progress: next } as typeof prev) : prev
    )
  }, [installationId, currentInstallation])

  const updateDefaultPdfEmail = useCallback(async (email: string | null) => {
    setDefaultPdfEmail(email)
    const supabase = createClient()
    if (supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await supabase
            .from('profiles')
            .update({ default_pdf_email: email } as Record<string, unknown>)
            .eq('id', user.id)
        }
      } catch { /* non-critical */ }
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
              .select('role, default_pdf_email')
              .eq('id', user.id)
              .single()
            if (profile?.role) role = profile.role as UserRole
            if (profile?.default_pdf_email) setDefaultPdfEmail(profile.default_pdf_email)
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
      value={{ currentInstallation, installationId, allInstallations, runways, areas, ceShops, typeShopMap, arffAircraft, facilities, switchInstallation, refreshCurrentInstallation, removeInstallation, userRole, defaultPdfEmail, updateDefaultPdfEmail, defaultOooMessage, updateDefaultOooMessage, defaultClosedMessage, updateDefaultClosedMessage, enabledModules, setupProgress, updateEnabledModules, markSetupStep, loaded }}
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
