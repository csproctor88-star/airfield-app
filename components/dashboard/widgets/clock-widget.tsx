'use client'
import { useEffect, useState } from 'react'
import { formatZuluDate } from '@/lib/utils'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function getZuluTime(d: Date): string {
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`
}

function getLocalTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function ClockWidget() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', gap: 6, textAlign: 'center',
    }}>
      <div style={{
        fontFamily: 'var(--font-mono, ui-monospace, monospace)',
        fontSize: 'var(--fs-2xl, 1.5rem)',
        fontWeight: 700,
        letterSpacing: '0.04em',
        color: 'var(--color-text-1)',
        lineHeight: 1.1,
      }}>
        {now ? getZuluTime(now) : '—'}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono, ui-monospace, monospace)',
        fontSize: 'var(--fs-xs)',
        color: 'var(--color-text-3)',
        letterSpacing: '0.03em',
      }}>
        {now ? formatZuluDate(now) : '—'}
      </div>
      <div style={{
        marginTop: 4,
        fontFamily: 'var(--font-mono, ui-monospace, monospace)',
        fontSize: 'var(--fs-sm)',
        color: 'var(--color-text-2)',
        letterSpacing: '0.02em',
      }}>
        {now ? getLocalTime(now) : '—'} <span style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-xs)' }}>LCL</span>
      </div>
    </div>
  )
}
