'use client'
import { useEffect, useState } from 'react'
import { X, Plus } from 'lucide-react'
import { formatZuluDate } from '@/lib/utils'
import { useInstallation } from '@/lib/installation-context'
import type { WidgetProps } from '@/lib/dashboard/widget-registry'

type ZoneEntry = { label: string; tz: string }
type ClockConfig = { zones?: ZoneEntry[] }

const CURATED_ZONES: { label: string; tz: string }[] = [
  { label: 'UTC / Zulu', tz: 'UTC' },
  { label: 'Eastern (ET)', tz: 'America/New_York' },
  { label: 'Central (CT)', tz: 'America/Chicago' },
  { label: 'Mountain (MT)', tz: 'America/Denver' },
  { label: 'Pacific (PT)', tz: 'America/Los_Angeles' },
  { label: 'Alaska (AKT)', tz: 'America/Anchorage' },
  { label: 'Hawaii (HST)', tz: 'Pacific/Honolulu' },
  { label: 'London (GMT/BST)', tz: 'Europe/London' },
  { label: 'Berlin (CET/CEST)', tz: 'Europe/Berlin' },
  { label: 'Dubai (GST)', tz: 'Asia/Dubai' },
  { label: 'Tokyo (JST)', tz: 'Asia/Tokyo' },
  { label: 'Sydney (AET)', tz: 'Australia/Sydney' },
]

function formatInTz(d: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).format(d)
  } catch {
    // Fallback to UTC if tz is invalid
    return new Intl.DateTimeFormat(undefined, {
      timeZone: 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).format(d)
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function getZuluTime(d: Date): string {
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`
}

/** Default view: Zulu + base-local, same as original widget. */
function DefaultClock({ now }: { now: Date | null }) {
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
        {now ? now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}{' '}
        <span style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-xs)' }}>LCL</span>
      </div>
    </div>
  )
}

export function ClockWidget({ config, editing, onConfigChange }: WidgetProps) {
  const c = config as ClockConfig
  const { currentInstallation } = useInstallation()
  const baseTz = currentInstallation?.timezone ?? undefined

  const [now, setNow] = useState<Date | null>(null)
  const [addLabel, setAddLabel] = useState('')
  const [addTz, setAddTz] = useState('UTC')
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const zones: ZoneEntry[] = Array.isArray(c.zones) && c.zones.length > 0 ? c.zones : []

  // Build curated list for the select, injecting base tz if not already there
  const selectOptions = baseTz && !CURATED_ZONES.some(z => z.tz === baseTz)
    ? [{ label: 'Base Local', tz: baseTz }, ...CURATED_ZONES]
    : CURATED_ZONES

  function removeZone(i: number) {
    const next = zones.filter((_, j) => j !== i)
    onConfigChange?.({ ...config, zones: next })
  }

  function addZone() {
    const label = addLabel.trim() || (selectOptions.find(o => o.tz === addTz)?.label ?? addTz)
    const next = [...zones, { label, tz: addTz }]
    onConfigChange?.({ ...config, zones: next })
    setAddLabel('')
    setAddTz('UTC')
    setShowAdd(false)
  }

  // Default: no zones configured — show original layout
  if (zones.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ flex: 1 }}>
          <DefaultClock now={now} />
        </div>
        {editing && onConfigChange && (
          <AddClockForm
            showAdd={showAdd} setShowAdd={setShowAdd}
            addLabel={addLabel} setAddLabel={setAddLabel}
            addTz={addTz} setAddTz={setAddTz}
            selectOptions={selectOptions}
            onAdd={addZone}
          />
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, height: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        {zones.map((z, i) => {
          const isZulu = z.tz === 'UTC' || z.tz === 'Etc/UTC'
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              padding: '3px 0',
              borderBottom: i < zones.length - 1 ? '1px solid var(--color-border)' : undefined,
            }}>
              <span style={{
                fontSize: 'var(--fs-xs)',
                color: 'var(--color-text-3)',
                flexShrink: 0,
                minWidth: 0,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: '40%',
              }}>{z.label}</span>
              <span style={{
                fontFamily: 'var(--font-mono, ui-monospace, monospace)',
                fontSize: isZulu ? 'var(--fs-base)' : 'var(--fs-sm)',
                fontWeight: isZulu ? 700 : 500,
                color: isZulu ? 'var(--color-text-1)' : 'var(--color-text-2)',
                letterSpacing: '0.04em',
                flexShrink: 0,
              }}>
                {now ? formatInTz(now, z.tz) : '—'}
                {isZulu && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginLeft: 2 }}>Z</span>}
              </span>
              {editing && (
                <button
                  onClick={() => removeZone(i)}
                  aria-label={`Remove ${z.label}`}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-3)', padding: 0, flexShrink: 0 }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )
        })}
      </div>
      {editing && onConfigChange && (
        <AddClockForm
          showAdd={showAdd} setShowAdd={setShowAdd}
          addLabel={addLabel} setAddLabel={setAddLabel}
          addTz={addTz} setAddTz={setAddTz}
          selectOptions={selectOptions}
          onAdd={addZone}
        />
      )}
    </div>
  )
}

interface AddClockFormProps {
  showAdd: boolean
  setShowAdd: (v: boolean) => void
  addLabel: string
  setAddLabel: (v: string) => void
  addTz: string
  setAddTz: (v: string) => void
  selectOptions: { label: string; tz: string }[]
  onAdd: () => void
}

function AddClockForm({ showAdd, setShowAdd, addLabel, setAddLabel, addTz, setAddTz, selectOptions, onAdd }: AddClockFormProps) {
  const microInput: React.CSSProperties = {
    padding: '4px 7px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
    color: 'var(--color-text-1)', fontSize: 'var(--fs-xs)', fontFamily: 'inherit',
  }

  if (!showAdd) {
    return (
      <button
        onClick={() => setShowAdd(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
          padding: '3px 8px', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)', background: 'transparent',
          color: 'var(--color-text-3)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-xs)',
        }}
      >
        <Plus size={11} /> Add clock
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingTop: 4, borderTop: '1px solid var(--color-border)' }}>
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          style={{ ...microInput, flex: '0 0 35%' }}
          placeholder="Label"
          value={addLabel}
          onChange={e => setAddLabel(e.target.value)}
        />
        <select
          style={{ ...microInput, flex: 1 }}
          value={addTz}
          onChange={e => setAddTz(e.target.value)}
        >
          {selectOptions.map(o => (
            <option key={o.tz} value={o.tz}>{o.label}</option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={onAdd}
          style={{
            flex: 1, padding: '4px 0', borderRadius: 'var(--radius-sm)', border: 'none',
            background: 'var(--color-accent)', color: '#fff', fontWeight: 700,
            fontFamily: 'inherit', fontSize: 'var(--fs-xs)', cursor: 'pointer',
          }}
        >Add</button>
        <button
          onClick={() => { setShowAdd(false) }}
          style={{
            flex: 1, padding: '4px 0', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)', background: 'transparent',
            color: 'var(--color-text-2)', fontFamily: 'inherit', fontSize: 'var(--fs-xs)', cursor: 'pointer',
          }}
        >Cancel</button>
      </div>
    </div>
  )
}
