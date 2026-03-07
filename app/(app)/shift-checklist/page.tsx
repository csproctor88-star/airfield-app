'use client'

import { useState, useEffect, useCallback } from 'react'
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

type ViewTab = 'today' | 'history'

const SHIFT_LABELS: Record<string, string> = { day: 'Day Shift', mid: 'Mid Shift', swing: 'Swing Shift' }
const FREQ_LABELS: Record<string, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }
const FREQ_COLORS: Record<string, string> = { daily: '#22D3EE', weekly: '#A78BFA', monthly: '#F59E0B' }

export default function ShiftChecklistPage() {
  const { installationId } = useInstallation()
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
      fetchOrCreateTodayChecklist(installationId),
    ])

    const todayItems = allItems.filter(i => itemAppliesToday(i))
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
  }, [installationId])

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
  const completedCount = allItemIds.filter(id => responseMap.get(id)?.completed).length
  const totalCount = allItemIds.length
  const allComplete = totalCount > 0 && completedCount === totalCount
  const isCompleted = checklist?.status === 'completed'

  async function handleToggle(itemId: string, currentlyCompleted: boolean) {
    if (!checklist || isCompleted) return
    setSaving(itemId)
    const { error } = await upsertResponse({
      checklist_id: checklist.id,
      item_id: itemId,
      completed: !currentlyCompleted,
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
          opacity: isCompleted && !checked ? 0.5 : 1,
        }}
      >
        <button
          disabled={isCompleted || isSaving}
          onClick={() => handleToggle(item.id, checked)}
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            border: checked ? 'none' : '2px solid var(--color-border-mid)',
            background: checked ? '#22C55E' : 'transparent',
            cursor: isCompleted ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'background 0.15s',
          }}
        >
          {checked && <span style={{ color: '#fff', fontSize: 14, fontWeight: 800, lineHeight: 1 }}>&#10003;</span>}
          {isSaving && !checked && <span style={{ fontSize: 10 }}>...</span>}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 'var(--fs-base)',
            fontWeight: 600,
            color: checked ? 'var(--color-text-3)' : 'var(--color-text-1)',
            textDecoration: checked ? 'line-through' : 'none',
          }}>
            {item.label}
          </div>
          {checked && resp?.completed_by && (
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
              {profiles[resp.completed_by] || 'Unknown'} &middot; {resp.completed_at ? new Date(resp.completed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
            </div>
          )}
        </div>

        {item.frequency !== 'daily' && (
          <span style={{
            fontSize: 'var(--fs-xs)',
            fontWeight: 700,
            color: FREQ_COLORS[item.frequency],
            background: `${FREQ_COLORS[item.frequency]}15`,
            padding: '2px 8px',
            borderRadius: 10,
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
    const shiftCompleted = shiftItems.every(i => responseMap.get(i.id)?.completed)

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
            color: shiftCompleted ? '#22C55E' : 'var(--color-text-3)',
          }}>
            {shiftItems.filter(i => responseMap.get(i.id)?.completed).length}/{shiftItems.length}
          </span>
        </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {shiftItems.map(renderItemRow)}
        </div>
      </div>
    )
  }

  const today = new Date()
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800 }}>Shift Checklist</div>
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
              borderRadius: 20,
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
                {completedCount}/{totalCount} items complete
              </div>
            </div>
            <div style={{
              fontSize: 'var(--fs-xs)',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 10,
              background: isCompleted ? 'rgba(34,197,94,0.12)' : 'rgba(234,179,8,0.12)',
              color: isCompleted ? '#22C55E' : '#EAB308',
            }}>
              {isCompleted ? 'FILED' : 'IN PROGRESS'}
            </div>
          </div>

          {/* Progress bar */}
          {totalCount > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{
                height: 6,
                borderRadius: 3,
                background: 'var(--color-bg-elevated)',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${(completedCount / totalCount) * 100}%`,
                  background: allComplete ? '#22C55E' : 'var(--color-cyan)',
                  borderRadius: 3,
                  transition: 'width 0.3s',
                }} />
              </div>
            </div>
          )}

          {!loaded ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-3)' }}>Loading...</div>
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
              {midItems.length > 0 && renderShiftSection('Mid Shift', midItems)}
              {renderShiftSection('Swing Shift', swingItems)}

              {/* Complete / Reopen button */}
              <div style={{ marginTop: 8 }}>
                {isCompleted ? (
                  <button
                    onClick={handleReopen}
                    style={{
                      width: '100%',
                      padding: '12px 0',
                      borderRadius: 8,
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
                      borderRadius: 8,
                      border: 'none',
                      background: allComplete ? '#22C55E' : 'var(--color-border)',
                      color: allComplete ? '#fff' : 'var(--color-text-3)',
                      fontWeight: 700,
                      fontSize: 'var(--fs-md)',
                      cursor: allComplete ? 'pointer' : 'not-allowed',
                      fontFamily: 'inherit',
                    }}
                  >
                    {completing ? 'Filing...' : allComplete ? 'File Checklist (End of Swing Shift)' : `Complete all items to file (${totalCount - completedCount} remaining)`}
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
            <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-3)' }}>
              No completed checklists yet.
            </div>
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
                        {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      {h.completed_by && (
                        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
                          Filed by {profiles[h.completed_by] || 'Unknown'}
                          {h.completed_at && ` at ${new Date(h.completed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontSize: 'var(--fs-xs)',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 8,
                        background: h.status === 'completed' ? 'rgba(34,197,94,0.12)' : 'rgba(234,179,8,0.12)',
                        color: h.status === 'completed' ? '#22C55E' : '#EAB308',
                      }}>
                        {h.status === 'completed' ? 'FILED' : 'IN PROGRESS'}
                      </span>
                      <span style={{ color: 'var(--color-text-4)', fontSize: 'var(--fs-lg)' }}>›</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'history' && viewingHistory && (() => {
        const hDate = new Date(viewingHistory.checklist_date + 'T12:00:00')
        const hDateStr = hDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
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
          const done = filtered.filter(i => hResponseMap.get(i.id)?.completed).length
          return (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="section-label" style={{ marginBottom: 0 }}>{label}</span>
                <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: done === filtered.length ? '#22C55E' : 'var(--color-text-3)' }}>
                  {done}/{filtered.length}
                </span>
              </div>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {filtered.map(item => {
                  const resp = hResponseMap.get(item.id)
                  const checked = resp?.completed ?? false
                  return (
                    <div key={item.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                      borderBottom: '1px solid var(--color-border)',
                    }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                        border: checked ? 'none' : '2px solid var(--color-border-mid)',
                        background: checked ? '#22C55E' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {checked && <span style={{ color: '#fff', fontSize: 14, fontWeight: 800 }}>&#10003;</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 'var(--fs-base)', fontWeight: 600,
                          color: checked ? 'var(--color-text-3)' : 'var(--color-text-1)',
                          textDecoration: checked ? 'line-through' : 'none',
                        }}>{item.label}</div>
                        {checked && resp?.completed_by && (
                          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
                            {profiles[resp.completed_by] || 'Unknown'}
                            {resp.completed_at && ` \u00b7 ${new Date(resp.completed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`}
                          </div>
                        )}
                      </div>
                      {item.frequency !== 'daily' && (
                        <span style={{
                          fontSize: 'var(--fs-xs)', fontWeight: 700, color: FREQ_COLORS[item.frequency],
                          background: `${FREQ_COLORS[item.frequency]}15`, padding: '2px 8px', borderRadius: 10,
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
                    {viewingHistory.completed_at && ` at ${new Date(viewingHistory.completed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`}
                  </div>
                )}
              </div>
              <div style={{
                fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '4px 10px', borderRadius: 10,
                background: viewingHistory.status === 'completed' ? 'rgba(34,197,94,0.12)' : 'rgba(234,179,8,0.12)',
                color: viewingHistory.status === 'completed' ? '#22C55E' : '#EAB308',
              }}>
                {viewingHistory.status === 'completed' ? 'FILED' : 'IN PROGRESS'}
              </div>
            </div>

            {!historyLoaded ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-3)' }}>Loading...</div>
            ) : (
              <>
                {renderHistorySection('Day Shift', hDayItems)}
                {hMidItems.length > 0 && renderHistorySection('Mid Shift', hMidItems)}
                {renderHistorySection('Swing Shift', hSwingItems)}
              </>
            )}
          </>
        )
      })()}
    </div>
  )
}
