'use client'

import { useEffect, useState } from 'react'
import { useInstallation } from '@/lib/installation-context'
import { fetchSightings, fetchStrikes, type WildlifeSightingRow, type WildlifeStrikeRow } from '@/lib/supabase/wildlife'
import { formatZuluDate } from '@/lib/utils'
import type { TableWidgetDescriptor, TableWidgetConfig } from '@/lib/dashboard/table/types'

// ── Unified row ──────────────────────────────────────────────

type WildlifeRow = {
  kind: 'Sighting' | 'Strike'
  id: string
  display_id: string
  species: string
  when: string
  whenIso: string
  location: string
  qty: number
  raw: WildlifeSightingRow | WildlifeStrikeRow
}

function toSightingRow(s: WildlifeSightingRow): WildlifeRow {
  return {
    kind: 'Sighting',
    id: s.id,
    display_id: s.display_id,
    species: s.species_common,
    when: formatZuluDate(s.observed_at),
    whenIso: s.observed_at,
    location: s.location_text ?? s.airfield_zone ?? '—',
    qty: s.count_observed,
    raw: s,
  }
}

function toStrikeRow(s: WildlifeStrikeRow): WildlifeRow {
  return {
    kind: 'Strike',
    id: s.id,
    display_id: s.display_id,
    species: s.species_common ?? 'Unknown',
    when: formatZuluDate(s.strike_date),
    whenIso: s.strike_date,
    location: s.location_text ?? '—',
    qty: s.number_struck,
    raw: s,
  }
}

// ── useRows ──────────────────────────────────────────────────

function useRows(_c: TableWidgetConfig) {
  const { installationId } = useInstallation()
  const [rows, setRows] = useState<WildlifeRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!installationId) return
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    Promise.all([
      fetchSightings(installationId, { startDate }),
      fetchStrikes(installationId, { startDate }),
    ]).then(([sr, sk]) => {
      const merged: WildlifeRow[] = [
        ...sr.data.map(toSightingRow),
        ...sk.data.map(toStrikeRow),
      ].sort((a, b) => b.whenIso.localeCompare(a.whenIso))
      setRows(merged)
      setLoading(false)
    })
  }, [installationId])

  return { rows, loading }
}

// ── Descriptor ───────────────────────────────────────────────

export const wildlifeDescriptor: TableWidgetDescriptor<WildlifeRow> = {
  columns: [
    { key: 'kind', label: 'Type', accessor: r => r.kind, defaultVisible: true },
    { key: 'species', label: 'Species', accessor: r => r.species, defaultVisible: true },
    { key: 'when', label: 'When', accessor: r => r.when, defaultVisible: true, mono: true },
    { key: 'location', label: 'Location', accessor: r => r.location, defaultVisible: true },
    { key: 'qty', label: 'Qty', accessor: r => r.qty, align: 'right' },
  ],
  filters: [
    {
      key: 'kind',
      label: 'Type',
      kind: 'enum-multi',
      options: [{ value: 'Sighting', label: 'Sighting' }, { value: 'Strike', label: 'Strike' }],
      predicate: (r, sel) => (sel as string[]).includes(r.kind),
    },
  ],
  row: {
    mode: 'detail',
    title: r => `${r.kind} ${r.display_id}`,
    fields: [
      { label: 'Type', value: r => r.kind },
      { label: 'Species', value: r => r.species },
      { label: 'When', value: r => r.when },
      { label: 'Location', value: r => r.location },
      { label: 'Qty', value: r => String(r.qty) },
      // Sighting-specific extras
      { label: 'Behavior', value: r => r.kind === 'Sighting' ? ((r.raw as WildlifeSightingRow).behavior ?? '—') : null, hideWhenEmpty: true },
      { label: 'Action Taken', value: r => r.kind === 'Sighting' ? ((r.raw as WildlifeSightingRow).action_taken ?? '—') : null, hideWhenEmpty: true },
      // Strike-specific extras
      { label: 'Aircraft Type', value: r => r.kind === 'Strike' ? ((r.raw as WildlifeStrikeRow).aircraft_type ?? '—') : null, hideWhenEmpty: true },
      { label: 'Damage Level', value: r => r.kind === 'Strike' ? ((r.raw as WildlifeStrikeRow).damage_level ?? '—') : null, hideWhenEmpty: true },
      { label: 'Phase of Flight', value: r => r.kind === 'Strike' ? ((r.raw as WildlifeStrikeRow).phase_of_flight ?? '—') : null, hideWhenEmpty: true },
      { label: 'Notes', value: r => (r.raw as WildlifeSightingRow | WildlifeStrikeRow).notes ?? '—', hideWhenEmpty: true },
    ],
  },
  summary: rows => {
    const sightings = rows.filter(r => r.kind === 'Sighting').length
    const strikes = rows.filter(r => r.kind === 'Strike').length
    return [
      { count: sightings, label: 'sightings' },
      ...(strikes > 0
        ? [{ count: strikes, label: 'strikes', tone: 'warning' as const }]
        : [{ count: 0, label: 'strikes' }]),
    ]
  },
  footerHref: '/wildlife',
  useRows,
}
