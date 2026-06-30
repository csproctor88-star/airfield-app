'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { AgingDiscrepanciesData, AgingTier } from '@/lib/reports/aging-discrepancies-data'

/** Apply the tier/shop cross-filter and recompute the summary — pure + testable.
 *  Lifted from app/(app)/reports/aging/page.tsx's filteredData memo. */
export function filterAging(
  data: AgingDiscrepanciesData,
  activeTierLabel: string | null,
  activeShop: string | null,
): AgingDiscrepanciesData {
  const filteredTiers: AgingTier[] = data.tiers.map((tier) => {
    if (activeTierLabel && tier.label !== activeTierLabel) return { ...tier, discrepancies: [] }
    if (activeShop) {
      return {
        ...tier,
        discrepancies: tier.discrepancies.filter((d) =>
          activeShop === '__unassigned' ? !d.assigned_shop : d.assigned_shop === activeShop,
        ),
      }
    }
    return tier
  })

  const allFiltered = filteredTiers.flatMap((t) => t.discrepancies)
  const total = allFiltered.length
  const shopCounts: Record<string, number> = {}
  let totalDays = 0
  let oldest: { display_id: string; title: string; days_open: number } | null = null
  for (const d of allFiltered) {
    const shop = d.assigned_shop || 'Unassigned'
    shopCounts[shop] = (shopCounts[shop] || 0) + 1
    totalDays += d.days_open
    if (!oldest || d.days_open > oldest.days_open) oldest = { display_id: d.display_id, title: d.title, days_open: d.days_open }
  }
  const byShop = Object.entries(shopCounts).sort((a, b) => b[1] - a[1]).map(([shop, count]) => ({ shop, count }))

  return { tiers: filteredTiers, summary: { total, byShop, avgDaysOpen: total > 0 ? Math.round(totalDays / total) : null, oldest } }
}

// Interactive aging view — tier/shop badge grids cross-filter the per-tier list.
// Filter state is uncontrolled by default (used by the dashboard widget). The
// report page drives it controlled via the `active*`/`on*Change` props so its
// PDF export can mirror the same filtered view.
export function AgingReportView({
  data,
  activeTierLabel: controlledTier,
  activeShop: controlledShop,
  onTierChange,
  onShopChange,
}: {
  data: AgingDiscrepanciesData
  activeTierLabel?: string | null
  activeShop?: string | null
  onTierChange?: (v: string | null) => void
  onShopChange?: (v: string | null) => void
}) {
  const [internalTier, setInternalTier] = useState<string | null>(null)
  const [internalShop, setInternalShop] = useState<string | null>(null)
  const activeTierLabel = controlledTier !== undefined ? controlledTier : internalTier
  const activeShop = controlledShop !== undefined ? controlledShop : internalShop
  const setActiveTierLabel = (v: string | null) => (onTierChange ?? setInternalTier)(v)
  const setActiveShop = (v: string | null) => (onShopChange ?? setInternalShop)(v)

  const filtered = useMemo(() => filterAging(data, activeTierLabel, activeShop), [data, activeTierLabel, activeShop])
  const hasFilters = activeTierLabel !== null || activeShop !== null
  const filterLabel = useMemo(() => {
    const parts: string[] = []
    if (activeTierLabel) parts.push(activeTierLabel)
    if (activeShop) parts.push(activeShop === '__unassigned' ? 'Unassigned' : activeShop)
    return parts.length > 0 ? parts.join(' / ') : 'All Open Discrepancies'
  }, [activeTierLabel, activeShop])

  const { tiers: allTiers, summary: fullSummary } = data
  const { summary: filteredSummary } = filtered
  const activeTiersWithItems = filtered.tiers.filter((t) => t.discrepancies.length > 0)

  return (
    <div>
      {hasFilters && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
          <button onClick={() => { setActiveTierLabel(null); setActiveShop(null) }} style={{
            background: 'none', border: '1px solid var(--color-border)', borderRadius: 6, padding: '4px 10px',
            color: 'var(--color-text-3)', fontSize: 'var(--fs-xs)', cursor: 'pointer', fontFamily: 'inherit',
          }}>Clear Filters</button>
        </div>
      )}

      {/* KPI Row */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
        <div className="kpi-badge" style={{ flex: '1 1 0', maxWidth: 200 }}>
          <div className="kpi-value" style={{ color: 'var(--color-text-1)' }}>{filteredSummary.total}</div>
          <div className="kpi-label">{hasFilters ? 'Filtered' : 'Total Open'}</div>
        </div>
        {filteredSummary.avgDaysOpen !== null && (
          <div className="kpi-badge" style={{ flex: '1 1 0', maxWidth: 200 }}>
            <div className="kpi-value" style={{ color: 'var(--color-warning)' }}>{filteredSummary.avgDaysOpen}</div>
            <div className="kpi-label">Avg Days</div>
          </div>
        )}
        {filteredSummary.oldest && (
          <div className="kpi-badge" style={{ flex: '1 1 0', maxWidth: 200 }}>
            <div className="kpi-value" style={{ color: 'var(--color-danger)' }}>{filteredSummary.oldest.days_open}</div>
            <div className="kpi-label">Oldest</div>
          </div>
        )}
      </div>

      {/* By Aging Tier — clickable */}
      <div className="card" style={{ padding: 14, marginBottom: 8 }}>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
          By Aging Tier {activeTierLabel && <span style={{ color: 'var(--color-cyan)', fontWeight: 400 }}>— click to clear</span>}
        </div>
        <div className="badge-grid">
          {allTiers.map((tier) => {
            const isActive = activeTierLabel === tier.label
            const count = tier.discrepancies.length
            return (
              <div key={tier.label} onClick={() => setActiveTierLabel(isActive ? null : tier.label)} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
                background: isActive ? `color-mix(in srgb, ${tier.color} 16%, transparent)` : `color-mix(in srgb, ${tier.color} 8%, transparent)`,
                border: isActive ? `2px solid ${tier.color}` : `1px solid color-mix(in srgb, ${tier.color} 20%, transparent)`,
                minWidth: 64, opacity: count === 0 ? 0.4 : 1, transition: 'border 0.15s, background 0.15s',
              }}>
                <div style={{ fontSize: 'var(--fs-4xl)', fontWeight: 800, color: tier.color }}>{count}</div>
                <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-2)', fontWeight: 600, textAlign: 'center', marginTop: 2 }}>{tier.label}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* By Shop — clickable */}
      {fullSummary.byShop.length > 0 && (
        <div className="card" style={{ padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            By Shop {activeShop && <span style={{ color: 'var(--color-cyan)', fontWeight: 400 }}>— click to clear</span>}
          </div>
          <div className="badge-grid">
            {fullSummary.byShop.map((s) => {
              const isActive = activeShop === s.shop
              return (
                <div key={s.shop} onClick={() => setActiveShop(isActive ? null : s.shop)} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
                  background: isActive ? 'color-mix(in srgb, var(--color-cyan) 16%, transparent)' : 'color-mix(in srgb, var(--color-cyan) 8%, transparent)',
                  border: isActive ? '2px solid var(--color-cyan)' : '1px solid color-mix(in srgb, var(--color-cyan) 20%, transparent)',
                  minWidth: 64, transition: 'border 0.15s, background 0.15s',
                }}>
                  <div style={{ fontSize: 'var(--fs-4xl)', fontWeight: 800, color: 'var(--color-cyan)' }}>{s.count}</div>
                  <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-2)', fontWeight: 600, textAlign: 'center', marginTop: 2 }}>{s.shop}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {hasFilters && (
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-cyan)', fontWeight: 600, marginBottom: 8, padding: '4px 0' }}>
          Showing: {filterLabel} ({filteredSummary.total} discrepancies)
        </div>
      )}

      {/* Item list per visible tier */}
      {activeTiersWithItems.map((tier) => (
        <div key={tier.label} className="card" style={{ padding: 14, marginBottom: 8 }}>
          <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, color: tier.color }}>
            {tier.label} ({tier.discrepancies.length})
          </div>
          {tier.discrepancies.map((d, i) => (
            <Link key={d.id} href={`/discrepancies/${d.id}`} style={{
              padding: '8px 10px', borderLeft: `3px solid ${tier.color}`,
              borderBottom: i < tier.discrepancies.length - 1 ? '1px solid color-mix(in srgb, var(--color-text-3) 12%, transparent)' : 'none',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, textDecoration: 'none',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-cyan)' }}>{d.display_id} — {d.title}</div>
                <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)' }}>{d.location_text} · {d.assigned_shop || 'Unassigned'}</div>
              </div>
              <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: tier.color, minWidth: 40, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{d.days_open}d</div>
            </Link>
          ))}
        </div>
      ))}

      {filteredSummary.total === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)', fontSize: 'var(--fs-md)' }}>
          No discrepancies match the selected filters
        </div>
      )}
    </div>
  )
}
