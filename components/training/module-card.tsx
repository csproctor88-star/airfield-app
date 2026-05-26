'use client'

import Link from 'next/link'
import { ChevronRight, Clock, Check } from 'lucide-react'
import { type ModuleRef } from '@/lib/training/modules'

/**
 * Tile-grid card for the /help Modules tab. Clicking the card
 * navigates to /help/[id] for the full deep dive.
 *
 * Visual treatment is intentionally muted across modules — the icon
 * tile carries the module color; the rest of the card uses neutral
 * borders so a grid of mixed-color modules reads cohesively instead
 * of as a rainbow. Role tagging drives the filter at the page level
 * but is not surfaced on the card (would add noise without value).
 *
 * `reviewed` flips the card to a green "completed" treatment with a
 * check badge in the chevron slot.
 */
export function ModuleCard({ module: m, reviewed = false }: { module: ModuleRef; reviewed?: boolean }) {
  const Icon = m.icon
  return (
    <Link
      href={`/help/${m.id}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 14,
        borderRadius: 'var(--radius-md)',
        background: reviewed
          ? 'color-mix(in srgb, var(--color-success) 6%, var(--color-bg-surface))'
          : 'var(--color-bg-surface)',
        border: reviewed
          ? '1px solid color-mix(in srgb, var(--color-success) 32%, transparent)'
          : '1px solid var(--color-border)',
        textDecoration: 'none',
        color: 'inherit',
        fontFamily: 'inherit',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div
          style={{
            width: 38,
            height: 38,
            minWidth: 38,
            borderRadius: 'var(--radius-md)',
            background: `color-mix(in srgb, ${m.color} 12%, transparent)`,
            border: `1px solid color-mix(in srgb, ${m.color} 30%, transparent)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: m.color,
            flexShrink: 0,
          }}
        >
          <Icon size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-1)' }}>
            {m.name}
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2, lineHeight: 1.4 }}>
            {m.tagline}
          </div>
        </div>
        {reviewed ? (
          <div
            title="Reviewed"
            style={{
              width: 22,
              height: 22,
              minWidth: 22,
              borderRadius: '50%',
              background: 'var(--color-success)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              marginTop: 4,
            }}
          >
            <Check size={13} strokeWidth={3} />
          </div>
        ) : (
          <ChevronRight size={16} style={{ color: 'var(--color-text-4)', flexShrink: 0, marginTop: 6 }} />
        )}
      </div>

      {m.readMinutes && (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          fontSize: 'var(--fs-2xs)',
          color: reviewed ? 'var(--color-success)' : 'var(--color-text-4)',
          fontWeight: 600,
          marginLeft: 48,
        }}>
          <Clock size={11} />
          {reviewed ? 'Reviewed' : `${m.readMinutes} min read`}
        </div>
      )}
    </Link>
  )
}
