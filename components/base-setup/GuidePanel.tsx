'use client'

import { useEffect, useState } from 'react'
import { ChevronRight, ChevronLeft, BookOpen } from 'lucide-react'
import { getStepGuide, formatComplianceStatement } from '@/lib/base-setup-guide'
import type { WizardStepKey } from '@/lib/modules-config'

const STORAGE_KEY = 'base-setup.guide.collapsed'

const HEAVY_STEPS: ReadonlySet<WizardStepKey> = new Set<WizardStepKey>([
  'lighting',
  'runways',
])

function readCollapsedMap(): Record<string, boolean> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeCollapsedMap(map: Record<string, boolean>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* localStorage full or disabled — silent */
  }
}

const REQUIRED_LABEL = {
  yes: 'Yes — every base must complete this step.',
  optional: 'Optional — skip if not relevant to this installation.',
  conditional: 'Conditional — required if the related module is enabled.',
} as const

export function GuidePanel({ stepKey }: { stepKey: WizardStepKey }) {
  const guide = getStepGuide(stepKey)
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    const map = readCollapsedMap()
    if (Object.prototype.hasOwnProperty.call(map, stepKey)) return Boolean(map[stepKey])
    return HEAVY_STEPS.has(stepKey)
  })

  useEffect(() => {
    const map = readCollapsedMap()
    if (Object.prototype.hasOwnProperty.call(map, stepKey)) {
      setCollapsed(Boolean(map[stepKey]))
    } else {
      setCollapsed(HEAVY_STEPS.has(stepKey))
    }
  }, [stepKey])

  const toggle = () => {
    setCollapsed(prev => {
      const next = !prev
      const map = readCollapsedMap()
      map[stepKey] = next
      writeCollapsedMap(map)
      return next
    })
  }

  if (!guide) return null

  if (collapsed) {
    return (
      <button
        onClick={toggle}
        data-tour="guide-panel"
        title="Open Guide"
        style={{
          width: 56,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          padding: '14px 6px',
          borderRadius: 10,
          border: '1px solid var(--color-border)',
          background: 'var(--color-bg-surface)',
          cursor: 'pointer',
          color: 'var(--color-cyan)',
          fontFamily: 'inherit',
          alignSelf: 'flex-start',
        }}
      >
        <ChevronLeft size={16} />
        <BookOpen size={16} />
        <span style={{
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          fontSize: 'var(--fs-xs)',
          fontWeight: 700,
          letterSpacing: 1,
        }}>GUIDE</span>
      </button>
    )
  }

  const headingStyle: React.CSSProperties = {
    fontSize: 'var(--fs-2xs)',
    fontWeight: 800,
    color: 'var(--color-cyan)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  }
  const bodyStyle: React.CSSProperties = {
    fontSize: 'var(--fs-sm)',
    color: 'var(--color-text-2)',
    lineHeight: 1.55,
    marginBottom: 14,
  }

  return (
    <aside
      data-tour="guide-panel"
      style={{
        width: 320,
        flexShrink: 0,
        alignSelf: 'flex-start',
        position: 'sticky',
        top: 12,
        maxHeight: 'calc(100vh - 24px)',
        overflowY: 'auto',
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: 12,
        paddingBottom: 10,
        borderBottom: '1px solid var(--color-border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'color-mix(in srgb, var(--color-cyan) 15%, transparent)',
            color: 'var(--color-cyan)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <BookOpen size={15} />
          </span>
          <span style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-1)' }}>
            Guide
          </span>
        </div>
        <button
          onClick={toggle}
          title="Collapse guide"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            borderRadius: 6,
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-inset)',
            color: 'var(--color-text-3)',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div style={headingStyle}>What this step does</div>
      <div style={bodyStyle}>{guide.what}</div>

      <div style={headingStyle}>How it works</div>
      <div style={bodyStyle}>{guide.how}</div>

      <div style={headingStyle}>Why it matters</div>
      <div style={bodyStyle}>{guide.why}</div>

      <div style={headingStyle}>Required?</div>
      <div style={bodyStyle}>{REQUIRED_LABEL[guide.required]}</div>

      <div style={headingStyle}>Examples</div>
      <ul style={{
        ...bodyStyle,
        margin: 0,
        marginBottom: 14,
        paddingLeft: 18,
      }}>
        {guide.examples.map((ex, i) => (
          <li key={i} style={{ marginBottom: 4 }}>{ex}</li>
        ))}
      </ul>

      <div style={{
        marginTop: 4,
        padding: 12,
        borderRadius: 8,
        background: 'color-mix(in srgb, var(--color-cyan) 8%, transparent)',
        border: '1px solid color-mix(in srgb, var(--color-cyan) 25%, transparent)',
      }}>
        <div style={{
          ...headingStyle,
          marginBottom: 6,
        }}>IAW Compliance</div>
        <div style={{
          fontSize: 'var(--fs-sm)',
          color: 'var(--color-text-1)',
          lineHeight: 1.5,
          fontWeight: 500,
        }}>
          {formatComplianceStatement(guide.cite)}
        </div>
      </div>
    </aside>
  )
}
