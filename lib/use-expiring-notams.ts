'use client'

import { useState, useEffect, useCallback } from 'react'
import { useInstallation } from '@/lib/installation-context'
import { createClient } from '@/lib/supabase/client'

/** Returns the count of FAA NOTAMs expiring within 24 hours */
export function useExpiringNotamCount() {
  const { currentInstallation } = useInstallation()
  const [count, setCount] = useState(0)
  const icao = currentInstallation?.icao || ''

  const check = useCallback(async () => {
    if (!icao || !createClient()) return
    try {
      const res = await fetch(`/api/notams/sync?icao=${encodeURIComponent(icao)}`)
      if (!res.ok) return
      const data = await res.json()
      const now = Date.now()
      const h24 = 24 * 60 * 60 * 1000
      const expiring = (data.notams || []).filter((n: { status: string; effective_end: string }) => {
        if (n.status !== 'active') return false
        const end = n.effective_end
        if (!end || end.toUpperCase() === 'PERM') return false
        const parsed = parseFaaDate(end) || new Date(end)
        if (isNaN(parsed.getTime())) return false
        const diff = parsed.getTime() - now
        return diff > 0 && diff <= h24
      })
      setCount(expiring.length)
    } catch {
      // silently fail
    }
  }, [icao])

  useEffect(() => {
    check()
    const interval = setInterval(check, 5 * 60 * 1000) // re-check every 5 min
    return () => clearInterval(interval)
  }, [check])

  return count
}

function parseFaaDate(str: string): Date | null {
  const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2})(\d{2})$/)
  if (!match) return null
  const [, month, day, year, hour, minute] = match
  return new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute))
}
