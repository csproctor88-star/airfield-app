'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { fetchDiscrepancies, type DiscrepancyRow } from '@/lib/supabase/discrepancies'
import { StatusBadge } from '@/components/ui/badge'
import { useInstallation } from '@/lib/installation-context'
import { DISCREPANCY_TYPES, CURRENT_STATUS_OPTIONS } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import { DEMO_DISCREPANCIES } from '@/lib/demo-data'
import { formatZuluDate, formatZuluDateTime } from '@/lib/utils'
import { StatusUpdateModal } from '@/components/discrepancies/modals'
import { toast } from 'sonner'

type ShopTab = string | '__all'

const CURRENT_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  CURRENT_STATUS_OPTIONS.map(o => [o.value, o.label])
)

const CURRENT_STATUS_COLORS: Record<string, string> = {
  submitted_to_afm: 'var(--color-status-inwork)',
  submitted_to_ces: 'var(--color-orange)',
  awaiting_action_by_ces: 'var(--color-warning)',
  waiting_for_project: 'var(--color-purple)',
  work_completed_awaiting_verification: 'var(--color-success)',
}

export default function CESDashboardPage() {
  const { installationId, ceShops, currentInstallation } = useInstallation()
  const [discrepancies, setDiscrepancies] = useState<DiscrepancyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [usingDemo, setUsingDemo] = useState(false)
  const [activeShop, setActiveShop] = useState<ShopTab>('__all')
  const [statusModal, setStatusModal] = useState<DiscrepancyRow | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      if (!supabase) {
        setUsingDemo(true)
        setLoading(false)
        return
      }
      const data = await fetchDiscrepancies(installationId)
      setDiscrepancies(data)
      setLoading(false)
    }
    load()
  }, [installationId])

  const daysOpen = (createdAt: string) =>
    Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000))

  const allItems = usingDemo ? DEMO_DISCREPANCIES as unknown as DiscrepancyRow[] : discrepancies

  // Only open discrepancies assigned to CES shops
  const cesItems = allItems.filter(d =>
    d.status === 'open' &&
    (d.current_status === 'submitted_to_ces' ||
     d.current_status === 'awaiting_action_by_ces' ||
     d.current_status === 'waiting_for_project' ||
     d.current_status === 'work_completed_awaiting_verification') &&
    d.assigned_shop
  )

  // Filter by selected shop
  const shopFiltered = activeShop === '__all'
    ? cesItems
    : cesItems.filter(d => d.assigned_shop === activeShop)

  // KPI counts
  const submittedCount = shopFiltered.filter(d => d.current_status === 'submitted_to_ces').length
  const inWorkCount = shopFiltered.filter(d => d.current_status === 'awaiting_action_by_ces').length
  const projectCount = shopFiltered.filter(d => d.current_status === 'waiting_for_project').length
  const awaitingVerifyCount = shopFiltered.filter(d => d.current_status === 'work_completed_awaiting_verification').length
  const overdueCount = shopFiltered.filter(d => daysOpen(d.created_at) > 30).length

  // Recently completed (last 7 days)
  const recentlyCompleted = allItems
    .filter(d => d.status === 'completed' && d.assigned_shop)
    .filter(d => activeShop === '__all' || d.assigned_shop === activeShop)
    .filter(d => {
      const resolved = d.resolution_date || d.updated_at
      return (Date.now() - new Date(resolved).getTime()) < 7 * 86400000
    })
    .slice(0, 10)

  // Per-shop counts for tabs
  const shopCounts: Record<string, number> = {}
  for (const d of cesItems) {
    if (d.assigned_shop) {
      shopCounts[d.assigned_shop] = (shopCounts[d.assigned_shop] || 0) + 1
    }
  }

  const getTypeLabel = (typeVal: string) =>
    typeVal.split(',').map(v => {
      const t = DISCREPANCY_TYPES.find(dt => dt.value === v.trim())
      return t ? `${t.emoji} ${t.label}` : v.trim()
    }).join(', ')

  const handleStatusSaved = (updated: DiscrepancyRow) => {
    setDiscrepancies(prev => prev.map(d => d.id === updated.id ? updated : d))
    setStatusModal(null)
  }

  const handleStatusDeleted = () => {
    if (statusModal) {
      setDiscrepancies(prev => prev.filter(d => d.id !== statusModal.id))
      setStatusModal(null)
    }
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800 }}>CES Work Orders</div>
          {currentInstallation && (
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
              {currentInstallation.name} ({currentInstallation.icao})
            </div>
          )}
        </div>
        <Link
          href="/discrepancies"
          style={{
            background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.3)',
            borderRadius: 8, padding: '7px 12px', color: 'var(--color-cyan)',
            fontSize: 'var(--fs-base)', fontWeight: 700, textDecoration: 'none',
          }}
        >
          All Discrepancies
        </Link>
      </div>

      {/* Shop tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setActiveShop('__all')}
          style={{
            padding: '5px 12px', borderRadius: 6, fontSize: 'var(--fs-sm)', fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
            border: activeShop === '__all' ? '1.5px solid var(--color-cyan)' : '1px solid var(--color-border)',
            background: activeShop === '__all' ? 'rgba(34,211,238,0.12)' : 'transparent',
            color: activeShop === '__all' ? 'var(--color-cyan)' : 'var(--color-text-2)',
          }}
        >
          All Shops
          <span style={{
            marginLeft: 6, fontSize: 'var(--fs-xs)', fontWeight: 600,
            background: activeShop === '__all' ? 'rgba(34,211,238,0.2)' : 'var(--color-border)',
            color: activeShop === '__all' ? 'var(--color-cyan)' : 'var(--color-text-3)',
            padding: '0 5px', borderRadius: 3,
          }}>
            {cesItems.length}
          </span>
        </button>
        {ceShops.map(shop => {
          const count = shopCounts[shop] || 0
          const active = activeShop === shop
          return (
            <button
              key={shop}
              type="button"
              onClick={() => setActiveShop(active ? '__all' : shop)}
              style={{
                padding: '5px 12px', borderRadius: 6, fontSize: 'var(--fs-sm)', fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
                border: active ? '1.5px solid var(--color-orange)' : '1px solid var(--color-border)',
                background: active ? 'rgba(249,115,22,0.12)' : 'transparent',
                color: active ? 'var(--color-orange)' : 'var(--color-text-2)',
              }}
            >
              {shop}
              {count > 0 && (
                <span style={{
                  marginLeft: 6, fontSize: 'var(--fs-xs)', fontWeight: 600,
                  background: active ? 'rgba(249,115,22,0.2)' : 'var(--color-border)',
                  color: active ? 'var(--color-orange)' : 'var(--color-text-3)',
                  padding: '0 5px', borderRadius: 3,
                }}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* KPI badges */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 16 }}>
        {[
          { label: 'NEW', value: submittedCount, color: 'var(--color-orange)', desc: 'Submitted to CES' },
          { label: 'IN WORK', value: inWorkCount, color: 'var(--color-warning)', desc: 'Awaiting action' },
          { label: 'PROJECT', value: projectCount, color: 'var(--color-purple)', desc: 'Waiting for project' },
          { label: 'VERIFY', value: awaitingVerifyCount, color: 'var(--color-success)', desc: 'Awaiting AFM verification' },
          { label: 'OVERDUE', value: overdueCount, color: overdueCount > 0 ? 'var(--color-danger)' : 'var(--color-success)', desc: '> 30 days open' },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ textAlign: 'center', padding: '10px 6px' }}>
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: 'var(--fs-3xl)', fontWeight: 800, color: kpi.color }}>
              {kpi.value}
            </div>
            <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-4)' }}>{kpi.desc}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)' }}>
          Loading...
        </div>
      ) : (
        <>
          {/* Active Work Queue */}
          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Active Work Queue ({shopFiltered.length})
          </div>

          {shopFiltered.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)', fontSize: 'var(--fs-md)' }}>
              No open work orders{activeShop !== '__all' ? ` for ${activeShop}` : ''}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20 }}>
              {shopFiltered
                .sort((a, b) => {
                  // Sort: overdue first, then by current_status priority, then by age
                  const aOverdue = daysOpen(a.created_at) > 30 ? 0 : 1
                  const bOverdue = daysOpen(b.created_at) > 30 ? 0 : 1
                  if (aOverdue !== bOverdue) return aOverdue - bOverdue
                  const statusOrder = ['submitted_to_ces', 'awaiting_action_by_ces', 'waiting_for_project', 'work_completed_awaiting_verification']
                  const aIdx = statusOrder.indexOf(a.current_status)
                  const bIdx = statusOrder.indexOf(b.current_status)
                  if (aIdx !== bIdx) return aIdx - bIdx
                  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                })
                .map(d => {
                  const days = daysOpen(d.created_at)
                  const statusColor = CURRENT_STATUS_COLORS[d.current_status] || 'var(--color-text-3)'
                  return (
                    <div
                      key={d.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 12px', background: 'var(--color-bg-surface)',
                        borderRadius: 8, border: `1px solid ${days > 30 ? 'rgba(239,68,68,0.3)' : 'var(--color-border)'}`,
                        fontSize: 'var(--fs-sm)',
                      }}
                    >
                      {/* Status indicator dot */}
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        background: statusColor,
                      }} />

                      <Link
                        href={`/discrepancies/${d.id}`}
                        style={{
                          flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2,
                          textDecoration: 'none', color: 'inherit',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 800, color: 'var(--color-cyan)', fontFamily: 'monospace', flexShrink: 0 }}>
                            {d.work_order_number || 'Pending'}
                          </span>
                          <span style={{ fontWeight: 600, color: 'var(--color-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                            {d.title}
                          </span>
                          <span style={{
                            fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '1px 6px', borderRadius: 4,
                            background: `${statusColor}18`, color: statusColor, flexShrink: 0,
                          }}>
                            {CURRENT_STATUS_LABELS[d.current_status] || d.current_status}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
                          <span>{getTypeLabel(d.type)}</span>
                          <span>{d.location_text}</span>
                          {activeShop === '__all' && d.assigned_shop && (
                            <span style={{ fontWeight: 600 }}>{d.assigned_shop}</span>
                          )}
                          <span style={{
                            color: days > 30 ? 'var(--color-danger)' : 'var(--color-text-3)',
                            fontWeight: days > 30 ? 700 : 400,
                          }}>
                            {days}d open
                          </span>
                        </div>
                      </Link>

                      {/* Quick action: Update Status */}
                      <button
                        type="button"
                        onClick={() => setStatusModal(d)}
                        style={{
                          background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.3)',
                          borderRadius: 6, padding: '4px 10px', color: 'var(--color-cyan)',
                          fontSize: 'var(--fs-xs)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                          flexShrink: 0, whiteSpace: 'nowrap',
                        }}
                      >
                        Update
                      </button>
                    </div>
                  )
                })}
            </div>
          )}

          {/* Recently Completed */}
          {recentlyCompleted.length > 0 && (
            <>
              <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-2)', marginBottom: 6, marginTop: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Recently Completed (7 days)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {recentlyCompleted.map(d => (
                  <Link
                    key={d.id}
                    href={`/discrepancies/${d.id}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 10px', background: 'var(--color-bg-surface)',
                      borderRadius: 6, border: '1px solid var(--color-border)',
                      fontSize: 'var(--fs-xs)', textDecoration: 'none', color: 'inherit',
                    }}
                  >
                    <span style={{ fontWeight: 700, color: 'var(--color-success)', fontFamily: 'monospace', flexShrink: 0 }}>
                      {d.work_order_number || d.display_id}
                    </span>
                    <span style={{ fontWeight: 600, color: 'var(--color-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {d.title}
                    </span>
                    <StatusBadge status={d.status} />
                    {d.assigned_shop && activeShop === '__all' && (
                      <span style={{ color: 'var(--color-text-3)', flexShrink: 0 }}>{d.assigned_shop}</span>
                    )}
                    <span style={{ color: 'var(--color-text-4)', flexShrink: 0 }}>
                      {formatZuluDate(new Date(d.resolution_date || d.updated_at))}
                    </span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {statusModal && (
        <StatusUpdateModal
          discrepancy={statusModal}
          onClose={() => setStatusModal(null)}
          onSaved={handleStatusSaved}
          onDeleted={handleStatusDeleted}
        />
      )}
    </div>
  )
}
