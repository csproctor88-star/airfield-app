'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useInstallation } from '@/lib/installation-context'
import { subscribeWithErrorHandling } from '@/lib/realtime-subscribe'
import { formatZuluTime } from '@/lib/utils'
import { CHECK_TYPE_CONFIG } from '@/lib/constants'
import { Clock } from 'lucide-react'

export function LastCheckWidget() {
  const { installationId } = useInstallation()
  const [label, setLabel] = useState<string | null>(null)
  const [time, setTime] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    if (!supabase || !installationId) return
    const { data } = await supabase
      .from('airfield_checks')
      .select('check_type, completed_at')
      .eq('base_id', installationId)
      .order('completed_at', { ascending: false })
      .limit(1)
    const raw = data?.[0]?.check_type ?? null
    setLabel(
      raw
        ? (CHECK_TYPE_CONFIG[raw as keyof typeof CHECK_TYPE_CONFIG]?.label?.toUpperCase() ??
            raw.replace(/_/g, ' ').toUpperCase())
        : null,
    )
    setTime(
      data?.[0]?.completed_at
        ? formatZuluTime(new Date(data[0].completed_at)) + 'Z'
        : null,
    )
  }, [installationId])

  useEffect(() => { load() }, [load])

  // Refresh when a new check is inserted
  useEffect(() => {
    const supabase = createClient()
    if (!supabase || !installationId) return
    const ch = supabase
      .channel(`last-check-widget:${installationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'airfield_checks', filter: `base_id=eq.${installationId}` },
        () => load(),
      )
    subscribeWithErrorHandling(ch)
    return () => { supabase.removeChannel(ch) }
  }, [installationId, load])

  const hasData = label && time

  return (
    <Link
      href="/checks"
      style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, height: '100%' }}
    >
      <Clock size={20} color={hasData ? 'var(--color-accent)' : 'var(--color-text-3)'} strokeWidth={2.25} />
      <div>
        <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Last Check
        </div>
        <div style={{
          fontSize: 'var(--fs-sm)', fontWeight: 600,
          fontFamily: 'var(--font-family-mono)', letterSpacing: '0.02em',
          color: hasData ? 'var(--color-accent)' : 'var(--color-text-3)',
        }}>
          {hasData ? `${label} @ ${time}` : '—'}
        </div>
      </div>
    </Link>
  )
}
