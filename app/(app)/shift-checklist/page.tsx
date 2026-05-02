'use client'

import { useState, useEffect, useCallback } from 'react'
import { Check, ChevronRight } from 'lucide-react'
import { useInstallation } from '@/lib/installation-context'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  fetchChecklistItems,
  fetchOrCreateTodayChecklist,
  fetchResponses,
  fetchChecklistHistory,
  upsertResponse,
  completeChecklist,
  reopenChecklist,
  itemAppliesToday,
  type ShiftChecklistItem,
  type ShiftChecklist,
  type ShiftChecklistResponse,
} from '@/lib/supabase/shift-checklist'
import { formatZuluTime, formatZuluDate } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingState } from '@/components/ui/loading-state'

type ViewTab = 'today' | 'history'

const SHIFT_LABELS: Record<string, string> = { day: 'Day Shift', mid: 'Mid Shift', swing: 'Swing Shift' }
const FREQ_LABELS: Record<string, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }
const FREQ_COLORS: Record<string, string> = { daily: 'var(--color-cyan)', weekly: 'var(--color-purple)', monthly: 'var(--color-warning)' }

export default function ShiftChecklistPage() {
  const { installationId, currentInstallation } = useInstallation()
  const timezone = currentInstallation?.timezone || 'America/New_York'
  const resetTime = (currentInstallation as Record<string, any>)?.checklist_reset_time || '06:00'
  const [tab, setTab] = useState<ViewTab>('today')
  const [items, setItems] = useState<ShiftChecklistItem[]>([])
  const [checklist, setChecklist] = useState<ShiftChecklist | null>(null)
  const [responses, setResponses] = useState<ShiftChecklistResponse[]>([])
  const [history, setHistory] = useState<ShiftChecklist[]>([])
  const [profiles, setProfiles] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null) // item_id being saved
  const [completing, setCompleting] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [viewingHistory, setViewingHistory] = useState<ShiftChecklist | null>(null)
  const [historyItems, setHistoryItems] = useState<ShiftChecklistItem[]>([])
  const [historyResponses, setHistoryResponses] = useState<ShiftChecklistResponse[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)

  const loadToday = useCallback(async () => {
    if (!installationId) return

    const [allItems, { checklist: cl }] = await Promise.all([
      fetchChecklistItems(installationId),
      fetchOrCreateTodayChecklist(installationId, timezone, resetTime),
    ])

    const todayItems = allItems.filter(i => itemAppliesToday(i, timezone, resetTime))
    setItems(todayItems)
    setChecklist(cl)

    if (cl) {
      const resp = await fetchResponses(cl.id)
      setResponses(resp)

      // Load profile names for completed_by
      const userIds = new Set<string>()
      resp.forEach(r => { if (r.completed_by) userIds.add(r.completed_by) })
      if (cl.completed_by) userIds.add(cl.completed_by)
      if (userIds.size > 0) await loadProfiles(Array.from(userIds))
    }

    setLoaded(true)
  }, [installationId, timezone, resetTime])

  const loadHistory = useCallback(async () => {
    if (!installationId) return
    const h = await fetchChecklistHistory(installationId)
    setHistory(h)

    const userIds = new Set<string>()
    h.forEach(c => { if (c.completed_by) userIds.add(c.completed_by) })
    if (userIds.size > 0) await loadProfiles(Array.from(userIds))
  }, [installationId])

  async function loadProfiles(ids: string[]) {
    const supabase = createClient()
    if (!supabase || ids.length === 0) return
    const { data } = await supabase
      .from('profiles')
      .select('id, name, rank')
      .in('id', ids)
    if (data) {
      const map: Record<string, string> = { ...profiles }
      data.forEach((p: { id: string; name: string; rank: string | null }) => {
        map[p.id] = p.rank ? `${p.rank} ${p.name}` : p.name
      })
      setProfiles(map)
    }
  }

  async function viewHistoryChecklist(cl: ShiftChecklist) {
    setViewingHistory(cl)
    setHistoryLoaded(false)
    const [allItems, resp] = await Promise.all([
      fetchChecklistItems(installationId),
      fetchResponses(cl.id),
    ])
    setHistoryItems(allItems)
    setHistoryResponses(resp)

    const userIds = new Set<string>()
    resp.forEach(r => { if (r.completed_by) userIds.add(r.completed_by) })
    if (cl.completed_by) userIds.add(cl.completed_by)
    if (userIds.size > 0) await loadProfiles(Array.from(userIds))
    setHistoryLoaded(true)
  }

  useEffect(() => { loadToday() }, [loadToday])
  useEffect(() => { if (tab === 'history') loadHistory() }, [tab, loadHistory])

  const responseMap = new Map(responses.map(r => [r.item_id, r]))

  const dayItems = items.filter(i => i.shift === 'day')
  const midItems = items.filter(i => i.shift === 'mid')
  const swingItems = items.filter(i => i.shift === 'swing')

  const allItemIds = items.map(i => i.id)
  const doneCount = allItemIds.filter(id => {
    const r = responseMap.get(id)
    return r?.completed || r?.is_na
  }).length
  const totalCount = allItemIds.length
  const allComplete = totalCount > 0 && doneCount === totalCount
  const isCompleted = checklist?.status === 'completed'

  async function handleToggle(itemId: string) {
    if (!checklist || isCompleted) return
    const resp = responseMap.get(itemId)
    const currentCompleted = resp?.completed ?? false
    const currentNa = resp?.is_na ?? false

    // Cycle: unchecked → completed → N/A → unchecked
    let nextCompleted = false
    let nextNa = false
    if (!currentCompleted && !currentNa) {
      nextCompleted = true  // → completed
    } else if (currentCompleted && !currentNa) {
      nextNa = true         // → N/A
    }
    // else: N/A → unchecked (both false)

    setSaving(itemId)
    const { error } = await upsertResponse({
      checklist_id: checklist.id,
      item_id: itemId,
      completed: nextCompleted,
      is_na: nextNa,
    })
    if (error) {
      toast.error(error)
    } else {
      await loadToday()
    }
    setSaving(null)
  }

  async function handleComplete() {
    if (!checklist || !allComplete) return
    if (!confirm('File this checklist as complete for today? This marks the end of swing shift.')) return
    setCompleting(true)
    const { error } = await completeChecklist(checklist.id)
    if (error) {
      toast.error(error)
    } else {
      toast.success('Shift checklist filed successfully')
      await loadToday()
    }
    setCompleting(false)
  }

  async function handleReopen() {
    if (!checklist) return
    if (!confirm('Reopen this checklist? Items will remain checked.')) return
    const { error } = await reopenChecklist(checklist.id)
    if (error) toast.error(error)
    else await loadToday()
  }

  function renderItemRow(item: ShiftChecklistItem) {
    const resp = responseMap.get(item.id)
    const checked = resp?.completed ?? false
    const isNa = resp?.is_na ?? false
    const isDone = checked || isNa
    const isSaving = saving === item.id

    return (
      <div
        key={item.id}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 14px',
          borderBottom: '1px solid var(--color-border)',
          opacity: isCompleted && !isDone ? 0.5 : 1,
        }}
      >
        <button
          disabled={isCompleted || isSaving}
          onClick={() => handleToggle(item.id)}
          style={{
            width: 24,
            height: 24,
            borderRadius: 'var(--radius-sm)',
            border: isDone ? 'none' : '2px solid var(--color-border-mid)',
            background: checked ? 'var(--color-success)' : isNa ? 'var(--color-text-3)' : 'transparent',
            cursor: isCompleted ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'background 0.15s',
          }}
        >
          {checked && <Check size={14} color="#fff" strokeWidth={3} />}
          {isNa && <span style={{ color: '#fff', fontSize: 10, fontWeight: 800, lineHeight: 1 }}>N/A</span>}
          {isSaving && !isDone && <span style={{ fontSize: 10 }}>...</span>}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 'var(--fs-base)',
            fontWeight: 600,
            color: isDone ? 'var(--color-text-3)' : 'var(--color-text-1)',
            textDecoration: checked ? 'line-through' : isNa ? 'line-through' : 'none',
            fontStyle: isNa ? 'italic' : 'normal',
          }}>
            {item.label}
          </div>
          {isDone && resp?.completed_by && (
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
              {profiles[resp.completed_by] || 'Unknown'}{isNa ? ' \u00b7 N/A' : ''} &middot; {resp.completed_at ? formatZuluTime(new Date(resp.completed_at)) + 'Z' : ''}
            </div>
          )}
        </div>

        {item.frequency !== 'daily' && (
          <span style={{
            fontSize: 'var(--fs-xs)',
            fontWeight: 700,
            color: FREQ_COLORS[item.frequency],
            background: `color-mix(in srgb, ${FREQ_COLORS[item.frequency]} 12%, transparent)`,
            padding: '2px 8px',
            borderRadius: 'var(--radius-md)',
            flexShrink: 0,
          }}>
            {FREQ_LABELS[item.frequency]}
          </span>
        )}
      </div>
    )
  }

  function renderShiftSection(label: string, shiftItems: ShiftChecklistItem[]) {
    if (shiftItems.length === 0) return null
    const shiftDoneCount = shiftItems.filter(i => {
      const r = responseMap.get(i.id)
      return r?.completed || r?.is_na
    }).length
    const shiftAllDone = shiftDoneCount === shiftItems.length

    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}>
          <span className="section-label" style={{ marginBottom: 0 }}>{label}</span>
          <span style={{
            fontSize: 'var(--fs-xs)',
            fontWeight: 700,
            color: shiftAllDone ? 'var(--color-success)' : 'var(--color-text-3)',
          }}>
            {shiftDoneCount}/{shiftItems.length}
          </span>
        </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {shiftItems.map(renderItemRow)}
        </div>
      </div>
    )
  }

  const today = new Date()
  const dateStr = formatZuluDate(today)

  return (
    <div className="page-container" data-tour="shift-checklist-header">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800 }}>Shift Checklist</div>
      </div>

      {/* Tab bar */}
      <div className="filter-bar" style={{ marginBottom: 14 }}>
        {(['today', 'history'] as ViewTab[]).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setViewingHistory(null) }}
            style={{
              background: tab === t ? 'var(--color-bg-elevated)' : 'transparent',
              border: `1px solid ${tab === t ? 'var(--color-text-4)' : 'var(--color-bg-elevated)'}`,
              color: tab === t ? 'var(--color-text-1)' : 'var(--color-text-3)',
              fontSize: 'var(--fs-base)',
              fontWeight: 600,
              padding: '5px 12px',
              borderRadius: 'var(--radius-full)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {t === 'today' ? "Today's Checklist" : 'History'}
          </button>
        ))}
      </div>

      {tab === 'today' && (
        <>
          {/* Date + status header */}
          <div className="card" style={{ padding: '12px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-1)' }}>{dateStr}</div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 2 }}>
                {doneCount}/{totalCount} items complete
              </div>
            </div>
            <div style={{
              fontSize: 'var(--fs-xs)',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 'var(--radius-md)',
              background: isCompleted ? 'color-mix(in srgb, var(--color-success) 12%, transparent)' : 'color-mix(in srgb, var(--color-bwc-mod) 12%, transparent)',
              color: isCompleted ? 'var(--color-success)' : 'var(--color-bwc-mod)',
            }}>
              {isCompleted ? 'FILED' : 'IN PROGRESS'}
            </div>
          </div>

          {/* Progress bar */}
          {totalCount > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{
                height: 6,
                borderRadius: 'var(--radius-xs)',
                background: 'var(--color-bg-elevated)',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${(doneCount / totalCount) * 100}%`,
                  background: allComplete ? 'var(--color-success)' : 'var(--color-cyan)',
                  borderRadius: 'var(--radius-xs)',
                  transition: 'width 0.3s',
                }} />
              </div>
            </div>
          )}

          {!loaded ? (
            <LoadingState />
          ) : totalCount === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 32 }}>
              <div style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-3)', marginBottom: 8 }}>
                No checklist items configured for today.
              </div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-4)' }}>
                An admin can set up shift checklist items in Settings &rarr; Base Configuration.
              </div>
            </div>
          ) : (
            <>
              {renderShiftSection('Day Shift', dayItems)}
              {renderShiftSection('Swing Shift', swingItems)}
              {midItems.length > 0 && renderShiftSection('Mid Shift', midItems)}

              {/* Complete / Reopen button */}
              <div style={{ marginTop: 8 }}>
                {isCompleted ? (
                  <button
                    onClick={handleReopen}
                    style={{
                      width: '100%',
                      padding: '12px 0',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border-mid)',
                      background: 'transparent',
                      color: 'var(--color-text-2)',
                      fontWeight: 700,
                      fontSize: 'var(--fs-md)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Reopen Checklist
                  </button>
                ) : (
                  <button
                    disabled={!allComplete || completing}
                    onClick={handleComplete}
                    style={{
                      width: '100%',
                      padding: '12px 0',
                      borderRadius: 'var(--radius-md)',
                      border: 'none',
                      background: allComplete ? 'var(--color-success)' : 'var(--color-border)',
                      color: allComplete ? '#fff' : 'var(--color-text-3)',
                      fontWeight: 700,
                      fontSize: 'var(--fs-md)',
                      cursor: allComplete ? 'pointer' : 'not-allowed',
                      fontFamily: 'inherit',
                    }}
                  >
                    {completing ? 'Filing...' : allComplete ? 'File Checklist (End of Swing Shift)' : `Complete all items to file (${totalCount - doneCount} remaining)`}
                  </button>
                )}
              </div>
            </>
          )}
        </>
      )}

      {tab === 'history' && !viewingHistory && (
        <div>
          {history.length === 0 ? (
            <EmptyState message="No completed checklists yet." />
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {history.map((h, i, arr) => {
                const d = new Date(h.checklist_date + 'T12:00:00')
                return (
                  <button
                    key={h.id}
                    onClick={() => viewHistoryChecklist(h)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none',
                      width: '100%',
                      background: 'none',
                      border: 'none',
                      borderBottomStyle: i < arr.length - 1 ? 'solid' : 'none',
                      borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                      borderBottomColor: 'var(--color-border)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--color-text-1)' }}>
                        {formatZuluDate(d)}
                      </div>
                      {h.completed_by && (
                        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
                          Filed by {profiles[h.completed_by] || 'Unknown'}
                          {h.completed_at && ` at ${formatZuluTime(new Date(h.completed_at))}Z`}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontSize: 'var(--fs-xs)',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-md)',
                        background: h.status === 'completed' ? 'color-mix(in srgb, var(--color-success) 12%, transparent)' : 'color-mix(in srgb, var(--color-bwc-mod) 12%, transparent)',
                        color: h.status === 'completed' ? 'var(--color-success)' : 'var(--color-bwc-mod)',
                      }}>
                        {h.status === 'completed' ? 'FILED' : 'IN PROGRESS'}
                      </span>
                      <ChevronRight size={16} style={{ color: 'var(--color-text-4)' }} />
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'history' && viewingHistory && (() => {
        const hDate = new Date(viewingHistory.checklist_date + 'T00:00:00Z')
        const hDateStr = formatZuluDate(hDate)
        const hResponseMap = new Map(historyResponses.map(r => [r.item_id, r]))
        const hDayItems = historyItems.filter(i => i.shift === 'day')
        const hMidItems = historyItems.filter(i => i.shift === 'mid')
        const hSwingItems = historyItems.filter(i => i.shift === 'swing')
        // Only show items that have a response for this checklist
        const hAllRespondedIds = new Set(historyResponses.map(r => r.item_id))
        const filterResponded = (list: ShiftChecklistItem[]) => list.filter(i => hAllRespondedIds.has(i.id))

        function renderHistorySection(label: string, sectionItems: ShiftChecklistItem[]) {
          const filtered = filterResponded(sectionItems)
          if (filtered.length === 0) return null
          const done = filtered.filter(i => { const r = hResponseMap.get(i.id); return r?.completed || r?.is_na }).length
          return (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="section-label" style={{ marginBottom: 0 }}>{label}</span>
                <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: done === filtered.length ? 'var(--color-success)' : 'var(--color-text-3)' }}>
                  {done}/{filtered.length}
                </span>
              </div>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {filtered.map(item => {
                  const resp = hResponseMap.get(item.id)
                  const checked = resp?.completed ?? false
                  const isNa = resp?.is_na ?? false
                  const isDone = checked || isNa
                  return (
                    <div key={item.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                      borderBottom: '1px solid var(--color-border)',
                    }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: 'var(--radius-sm)', flexShrink: 0,
                        border: isDone ? 'none' : '2px solid var(--color-border-mid)',
                        background: checked ? 'var(--color-success)' : isNa ? 'var(--color-text-3)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {checked && <Check size={14} color="#fff" strokeWidth={3} />}
                        {isNa && <span style={{ color: '#fff', fontSize: 10, fontWeight: 800 }}>N/A</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 'var(--fs-base)', fontWeight: 600,
                          color: isDone ? 'var(--color-text-3)' : 'var(--color-text-1)',
                          textDecoration: isDone ? 'line-through' : 'none',
                          fontStyle: isNa ? 'italic' : 'normal',
                        }}>{item.label}</div>
                        {isDone && resp?.completed_by && (
                          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
                            {profiles[resp.completed_by] || 'Unknown'}{isNa ? ' \u00b7 N/A' : ''}
                            {resp.completed_at && ` \u00b7 ${formatZuluTime(new Date(resp.completed_at))}Z`}
                          </div>
                        )}
                      </div>
                      {item.frequency !== 'daily' && (
                        <span style={{
                          fontSize: 'var(--fs-xs)', fontWeight: 700, color: FREQ_COLORS[item.frequency],
                          background: `${FREQ_COLORS[item.frequency]}15`, padding: '2px 8px', borderRadius: 'var(--radius-md)',
                        }}>{FREQ_LABELS[item.frequency]}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        }

        return (
          <>
            <button
              onClick={() => { setViewingHistory(null); setHistoryItems([]); setHistoryResponses([]) }}
              style={{ background: 'none', border: 'none', color: 'var(--color-cyan)', fontSize: 'var(--fs-md)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0, marginBottom: 12 }}
            >
              &larr; Back to History
            </button>

            <div className="card" style={{ padding: '12px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-1)' }}>{hDateStr}</div>
                {viewingHistory.completed_by && (
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 2 }}>
                    Filed by {profiles[viewingHistory.completed_by] || 'Unknown'}
                    {viewingHistory.completed_at && ` at ${formatZuluTime(new Date(viewingHistory.completed_at))}Z`}
                  </div>
                )}
              </div>
              <div style={{
                fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '4px 10px', borderRadius: 'var(--radius-md)',
                background: viewingHistory.status === 'completed' ? 'color-mix(in srgb, var(--color-success) 12%, transparent)' : 'color-mix(in srgb, var(--color-bwc-mod) 12%, transparent)',
                color: viewingHistory.status === 'completed' ? 'var(--color-success)' : 'var(--color-bwc-mod)',
              }}>
                {viewingHistory.status === 'completed' ? 'FILED' : 'IN PROGRESS'}
              </div>
            </div>

            {!historyLoaded ? (
              <LoadingState />
            ) : (
              <>
                {renderHistorySection('Day Shift', hDayItems)}
                {renderHistorySection('Swing Shift', hSwingItems)}
                {hMidItems.length > 0 && renderHistorySection('Mid Shift', hMidItems)}
              </>
            )}
          </>
        )
      })()}
    </div>
  )
}
