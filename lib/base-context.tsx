'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { Base, BaseRunway, BaseArea } from '@/lib/supabase/types'
import { fetchBase, fetchBaseRunways, fetchBaseAreas, getUserPrimaryBaseId, fetchBases } from '@/lib/supabase/bases'
import { createClient } from '@/lib/supabase/client'

// Selfridge fallback ID (used when DB not available / demo mode)
const SELFRIDGE_BASE_ID = '00000000-0000-0000-0000-000000000001'

export interface BaseContextValue {
  /** Current active base (null while loading) */
  currentBase: Base | null
  /** Current base ID (available before full base loads) */
  baseId: string | null
  /** All bases the user has access to */
  allBases: Base[]
  /** Runways for the current base */
  runways: BaseRunway[]
  /** Airfield areas for the current base */
  areas: string[]
  /** CE shops for the current base */
  ceShops: string[]
  /** Switch to a different base */
  switchBase: (baseId: string) => Promise<void>
  /** Whether the context has finished initial loading */
  loaded: boolean
}

const BaseContext = createContext<BaseContextValue | null>(null)

export function BaseProvider({ children }: { children: ReactNode }) {
  const [currentBase, setCurrentBase] = useState<Base | null>(null)
  const [baseId, setBaseId] = useState<string | null>(null)
  const [allBases, setAllBases] = useState<Base[]>([])
  const [runways, setRunways] = useState<BaseRunway[]>([])
  const [areas, setAreas] = useState<string[]>([])
  const [ceShops, setCeShops] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)

  // Load a specific base's configuration
  const loadBaseConfig = useCallback(async (id: string) => {
    const [base, baseRunways, baseAreas] = await Promise.all([
      fetchBase(id),
      fetchBaseRunways(id),
      fetchBaseAreas(id),
    ])

    if (base) {
      setCurrentBase(base)
      setBaseId(base.id)
      setCeShops(base.ce_shops || [])
    }
    setRunways(baseRunways)
    setAreas(baseAreas.map(a => a.area_name))
  }, [])

  // Switch to a different base and persist the choice
  const switchBase = useCallback(async (newBaseId: string) => {
    setBaseId(newBaseId)
    await loadBaseConfig(newBaseId)

    // Persist choice to profile
    const supabase = createClient()
    if (supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await supabase
            .from('profiles')
            .update({ primary_base_id: newBaseId })
            .eq('id', user.id)
        }
      } catch {
        // Non-critical — user can re-select
      }
    }
  }, [loadBaseConfig])

  // Initial load
  useEffect(() => {
    async function init() {
      // Fetch all available bases
      const bases = await fetchBases()
      setAllBases(bases)

      // Determine which base to load
      let primaryId = await getUserPrimaryBaseId()

      // Fallback: use Selfridge if no primary set, or first available base
      if (!primaryId) {
        primaryId = bases.length > 0 ? bases[0].id : SELFRIDGE_BASE_ID
      }

      setBaseId(primaryId)
      await loadBaseConfig(primaryId)
      setLoaded(true)
    }

    init()
  }, [loadBaseConfig])

  // Don't render children until initial load completes
  if (!loaded) return null

  return (
    <BaseContext.Provider
      value={{ currentBase, baseId, allBases, runways, areas, ceShops, switchBase, loaded }}
    >
      {children}
    </BaseContext.Provider>
  )
}

export function useBase() {
  const ctx = useContext(BaseContext)
  if (!ctx) throw new Error('useBase must be used within BaseProvider')
  return ctx
}
