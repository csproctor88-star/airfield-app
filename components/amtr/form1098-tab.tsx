'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Pencil, BookOpen, Lock, RotateCcw, Archive } from 'lucide-react'
import { toast } from 'sonner'
import { upsertAmtrRow, updateAmtrRow, deleteAmtrRow, fetchAmtrByBase, insertAmtrRows, createAmtrNotification, type AmtrMember, type AmtrRole } from '@/lib/supabase/amtr'
import { ResourceDialog } from '@/components/amtr/resource-dialog'
import { buildSignoff, buildTrainingDue, fireToTrainingTeam, type NotificationDraft } from '@/lib/amtr/notifications'
import { dueStatus, computeNextDue } from '@/lib/amtr/status'
import { canSignSlot, canReopen, type SignSlot } from '@/lib/amtr/roles'
import { StatusPill } from '@/components/amtr/status-pill'
import { SignCell } from '@/components/amtr/signable'
import { SimpleCatalogEditor } from '@/components/amtr/simple-catalog-editor'
import { Btn, thStyle, tdStyle } from '@/components/amtr/ui'
import type { SignSource } from '@/components/amtr/auto-623a-dialog'

const FREQ_OPTIONS = ['', 'Monthly', 'Quarterly', 'Semi-Annual', 'Annual', 'Biennial', 'Triennial', 'As Required']

type Row = Record<string, unknown>
type SignFn = (table: 'amtr_1098_progress', rowId: string, slot: SignSlot, onSigned?: () => Promise<void>, source?: SignSource) => Promise<void>
type ReopenFn = (table: 'amtr_1098_progress', rowId: string, slot: SignSlot) => Promise<void>

export function Form1098Tab(props: {
  catalog: Row[]; progress: Row[]; canWrite: boolean; canEnterData: boolean; canManage: boolean
  installationId: string; memberId: string; member: AmtrMember; myRoles: AmtrRole[]; isOwn: boolean
  highlightItem: string | null; sign: SignFn; reopen: ReopenFn; onChange: () => void
}) {
  const { catalog, progress, canWrite, canEnterData, canManage, installationId, memberId, member, myRoles, isOwn, highlightItem, sign, reopen, onChange } = props
  const [editMode, setEditMode] = useState(false)
  // KPI status filter for the task table. null = show all (Required).
  const [statusFilter, setStatusFilter] = useState<'complete' | 'due_soon' | 'overdue' | null>(null)
  const currentYear = String(new Date().getUTCFullYear())
  const [year, setYear] = useState(currentYear)
  // Full year rows (with archive state) — needed to render the lock
  // indicator and gate edits/sign/archive actions per-year.
  const [yearRows, setYearRows] = useState<Row[]>([])
  const [resources, setResources] = useState<Map<string, Row[]>>(new Map())
  const [resourceFor, setResourceFor] = useState<Row | null>(null)
  // Year tab list = currentYear + years explicitly added via the base
  // amtr_1098_years table + years this member has progress in. We
  // intentionally DON'T pull from `catalog` here — the 1098 catalog is
  // base-shared and per-year after Phase B, so every year's catalog
  // row would create a tab on every member's record. That made the
  // delete-year action look broken: progress + years row would delete
  // but the tab persisted because the base catalog still had rows for
  // that year.
  const years = Array.from(new Set([
    currentYear,
    ...yearRows.map((r) => String(r.year_label)).filter(Boolean),
    ...progress.map((p) => String(p.year_label)).filter(Boolean),
  ])).sort((a, b) => b.localeCompare(a))
  const yearRowByLabel = new Map(yearRows.map((r) => [String(r.year_label), r]))
  const isArchived = !!yearRowByLabel.get(year)?.archived
  // Catalog is now per-year; only show rows tagged for the active year.
  const yearCatalog = catalog.filter((c) => String(c.year_label) === year)
  const progByCat = new Map(progress.filter((p) => p.year_label === year).map((p) => [String(p.catalog_id), p]))
  const reopenAllowed = canReopen(myRoles) && !isArchived
  // Effective "can enter data" gate — archive overrides everything.
  const canEditThisYear = canEnterData && !isArchived
  const canManageThisYear = canManage && !isArchived

  const loadResources = useCallback(async () => {
    const rows = await fetchAmtrByBase<Row>('amtr_1098_resources', installationId)
    const m = new Map<string, Row[]>()
    for (const r of rows) { const k = String(r.catalog_id); if (!m.has(k)) m.set(k, []); m.get(k)!.push(r) }
    setResources(m)
  }, [installationId])
  const loadYears = useCallback(async () => {
    setYearRows(await fetchAmtrByBase<Row>('amtr_1098_years', installationId))
  }, [installationId])
  useEffect(() => {
    loadYears()
    loadResources()
  }, [loadYears, loadResources])

  // Clone an existing year's catalog into a new year_label so the new year
  // starts with the same task list. Source is the most-recent populated
  // year (which handles bases where currentYear's catalog isn't yet
  // populated — e.g., a base that's still transcribing 2024). No-op if
  // the target year already has catalog rows. Called on year creation +
  // auto-rollover.
  const cloneCatalogForYear = useCallback(async (targetYear: string) => {
    if (catalog.some((c) => String(c.year_label) === targetYear)) return
    const populated = Array.from(new Set(catalog.map((c) => String(c.year_label)).filter(Boolean))).sort().reverse()
    const sourceYear = populated[0]
    if (!sourceYear) return
    const source = catalog.filter((c) => String(c.year_label) === sourceYear)
    if (source.length === 0) return
    const rows = source.map((c) => ({
      base_id: installationId,
      year_label: targetYear,
      task: c.task,
      type: c.type ?? null,
      frequency: c.frequency ?? 'Annual',
      sort_order: c.sort_order ?? 0,
    }))
    const { error } = await insertAmtrRows('amtr_1098_catalog', rows)
    if (error) toast.error(error)
  }, [catalog, installationId])

  const addYear = async () => {
    const y = window.prompt('Add a year (e.g. 2027 for next year, 2024 for transcription):')?.trim()
    if (!y || !/^\d{4}$/.test(y)) return
    const { error } = await upsertAmtrRow(
      'amtr_1098_years',
      { base_id: installationId, year_label: y, is_current: false },
      { onConflict: 'base_id,year_label' },
    )
    if (error) { toast.error(error); return }
    // Seed the new year's catalog from the latest populated year so the
    // task list starts populated rather than empty.
    await cloneCatalogForYear(y)
    // Materialize any pending rollovers: every member's earlier-year
    // progress with next_due falling in `y` gets a fresh `y` progress
    // row carrying that due date. This is how completions that
    // happened BEFORE `y` was opened flow forward without the prior
    // catalog-clone behavior creating phantom rows for everyone.
    await materializeRollovers(y)
    await loadYears()
    onChange()
    setYear(y)
  }

  // For a freshly-opened year, scan every member's progress for rows
  // whose next_due lands in `newYear` and seed a corresponding progress
  // row in `newYear` for each. Skips rows that already have a newYear
  // progress entry. Base-scoped (touches every member at the base).
  const materializeRollovers = async (newYear: string) => {
    const [allProgress, allCatalog] = await Promise.all([
      fetchAmtrByBase<Row>('amtr_1098_progress', installationId, 'member_id'),
      fetchAmtrByBase<Row>('amtr_1098_catalog', installationId),
    ])
    const catById = new Map(allCatalog.map((c) => [String(c.id), c]))
    const newYearByTask = new Map(
      allCatalog.filter((c) => String(c.year_label) === newYear).map((c) => [String(c.task), c]),
    )
    if (newYearByTask.size === 0) return
    const newYearExisting = new Set(
      allProgress
        .filter((p) => String(p.year_label) === newYear)
        .map((p) => `${String(p.member_id)}|${String(p.catalog_id)}`),
    )
    for (const p of allProgress) {
      if (String(p.year_label) >= newYear) continue
      const nd = p.next_due as string | undefined
      if (!nd) continue
      const dueYear = String(new Date(`${String(nd).slice(0, 10)}T00:00:00Z`).getUTCFullYear())
      if (dueYear !== newYear) continue
      const sourceCat = catById.get(String(p.catalog_id))
      if (!sourceCat) continue
      const target = newYearByTask.get(String(sourceCat.task))
      if (!target) continue
      const key = `${String(p.member_id)}|${String(target.id)}`
      if (newYearExisting.has(key)) continue
      await upsertAmtrRow(
        'amtr_1098_progress',
        { base_id: installationId, member_id: p.member_id, catalog_id: String(target.id), year_label: newYear, next_due: nd },
        { onConflict: 'member_id,catalog_id,year_label' },
      )
      newYearExisting.add(key)
    }
  }
  const deleteYear = async () => {
    if (year === currentYear) return
    if (isArchived) { toast.error('Unarchive this year before deleting.'); return }
    if (!window.confirm(`Delete the ${year} 1098 for ${member.full_name}? This removes their ${year} entries (use to purge years past the retention requirement).`)) return
    // Remove this member's progress rows for the year.
    for (const p of progress.filter((x) => String(x.year_label) === year)) await deleteAmtrRow('amtr_1098_progress', String(p.id))
    // Remove the base year-tab row(s) for that label so the empty tab goes away.
    const allYears = await fetchAmtrByBase<Row>('amtr_1098_years', installationId)
    for (const yr of allYears.filter((r) => String(r.year_label) === year)) await deleteAmtrRow('amtr_1098_years', String(yr.id))
    await loadYears()
    setYear(currentYear)
    onChange()
  }
  const archiveYear = async () => {
    if (year === currentYear) { toast.error("Can't archive the current year."); return }
    if (!window.confirm(`Archive ${year}? All records for ${year} become read-only — no date edits, no signatures, no catalog changes. Only NAMT/AFM/Base Admin can unarchive.`)) return
    // Ensure a year row exists for this label (may not if year was inferred
    // from progress rows only), then flip archived = true.
    const existing = yearRowByLabel.get(year)
    if (existing?.id) {
      const { error } = await updateAmtrRow('amtr_1098_years', String(existing.id), {
        archived: true, archived_at: new Date().toISOString(),
      })
      if (error) { toast.error(error); return }
    } else {
      const { error } = await upsertAmtrRow('amtr_1098_years',
        { base_id: installationId, year_label: year, is_current: false, archived: true, archived_at: new Date().toISOString() },
        { onConflict: 'base_id,year_label' })
      if (error) { toast.error(error); return }
    }
    await loadYears()
    toast.success(`${year} archived — records frozen.`)
  }
  const unarchiveYear = async () => {
    const existing = yearRowByLabel.get(year)
    if (!existing?.id) return
    if (!window.confirm(`Unarchive ${year}? Records will become editable again.`)) return
    const { error } = await updateAmtrRow('amtr_1098_years', String(existing.id), {
      archived: false, archived_at: null, archived_by: null,
    })
    if (error) { toast.error(error); return }
    await loadYears()
    toast.success(`${year} unarchived.`)
  }

  // Reconcile current-year due/overdue 1098 items → notify the whole training
  // team (trainee + trainers + NAMT + AFM). Idempotent (dedupe upsert); run
  // once per member per mount to limit chatter.
  const reconciledFor = useRef<string | null>(null)
  useEffect(() => {
    if (catalog.length === 0 || reconciledFor.current === memberId) return
    reconciledFor.current = memberId
    const curYearProg = new Map(progress.filter((p) => p.year_label === currentYear).map((p) => [String(p.catalog_id), p]))
    const curYearCatalog = catalog.filter((c) => String(c.year_label) === currentYear)
    for (const c of curYearCatalog) {
      if (c.retired) continue
      const p = curYearProg.get(String(c.id))
      const next = (p?.next_due as string) ?? null
      if (!next) continue
      const s = dueStatus({ dueDate: next, completedDate: (p?.last_completed as string) ?? '' })
      if (s === 'due_soon' || s === 'overdue') {
        void fireToTrainingTeam(installationId, memberId, member.user_id, buildTrainingDue(String(c.task), next, String(c.id)))
      }
    }
  }, [memberId, catalog, progress, currentYear, installationId, member.user_id])

  if (editMode) {
    return (
      <SimpleCatalogEditor table="amtr_1098_catalog" rows={yearCatalog} installationId={installationId}
        columns={[{ key: 'task', label: 'Task', flex: true }, { key: 'type', label: 'Type', width: 110 }, { key: 'frequency', label: 'Frequency', type: 'select', options: FREQ_OPTIONS, width: 130 }, { key: 'score_or_hours', label: 'Score/Hrs', width: 90 }]}
        defaults={{ task: 'New Task', frequency: 'Annual', year_label: year }} onDone={() => setEditMode(false)} onChange={onChange} />
    )
  }

  if (yearCatalog.length === 0) return (
    <div className="card" style={{ color: 'var(--color-text-3)' }}>
      No 1098 catalog for {year}. {year === currentYear
        ? 'Load it from Roles & Catalogs.'
        : <button onClick={() => cloneCatalogForYear(year).then(onChange)} style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', textDecoration: 'underline', font: 'inherit' }}>Clone the current year&apos;s catalog into {year}</button>}
    </div>
  )
  const activeCatalog = yearCatalog.filter((c) => !c.retired)

  const ensure = async (catId: string): Promise<string> => {
    const ex = progByCat.get(catId)
    if (ex) return String(ex.id)
    const { data, error } = await upsertAmtrRow(
      'amtr_1098_progress',
      { base_id: installationId, member_id: memberId, catalog_id: catId, year_label: year },
      { onConflict: 'member_id,catalog_id,year_label' },
    )
    if (error) { toast.error(error); return '' }
    return String(data?.id ?? '')
  }
  const setField = async (catId: string, freq: string, field: string, value: string) => {
    const existing = progByCat.get(catId)
    const patch: Row = { base_id: installationId, member_id: memberId, catalog_id: catId, year_label: year, [field]: value || null }
    if (field === 'last_completed') {
      // Manual override wins until the user explicitly clears it (per
      // feedback_due_date_override semantics). Only recompute next_due
      // automatically if the row has no manual override flag.
      if (!existing?.next_due_manual) {
        patch.next_due = computeNextDue(value, freq)
      }
    }
    if (field === 'next_due') {
      // Manual edit of the due date flips the override flag so that
      // future last_completed edits won't overwrite it.
      patch.next_due_manual = !!value
    }
    const { error } = await upsertAmtrRow('amtr_1098_progress', patch, { onConflict: 'member_id,catalog_id,year_label' })
    if (error) { toast.error(error); return }
    // Auto-rollover: completing a task whose next due lands in a later
    // year seeds that task on the next year's 1098 for THIS member —
    // but only if the admin has already opened that year (its catalog
    // already has a row for the task). When next year is NOT open,
    // the next_due is still recorded on the current year's row (above);
    // it'll materialize into next year's progress later, when the admin
    // opens the year via +Add Year (which calls materializeRollovers).
    //
    // Rationale: the catalog is base-shared. Auto-cloning a catalog
    // into next year used to make that year visible to every member —
    // including ones with no actual data there — which was confusing.
    // See migration 2026061401 for the cleanup of those phantom rows.
    const nextDue = (patch.next_due as string | undefined) ?? (existing?.next_due as string | undefined)
    if (field === 'last_completed' && value && nextDue) {
      const nextYear = String(new Date(`${String(nextDue).slice(0, 10)}T00:00:00Z`).getUTCFullYear())
      if (Number(nextYear) > Number(year)) {
        const thisYearCat = yearCatalog.find((c) => String(c.id) === catId)
        if (thisYearCat) {
          const nextYearCatRows = catalog.filter((c) => String(c.year_label) === nextYear)
          const target = nextYearCatRows.find((c) => String(c.task) === String(thisYearCat.task))
          if (target) {
            const existsNext = progress.some((x) =>
              String(x.year_label) === nextYear && String(x.catalog_id) === String(target.id),
            )
            if (!existsNext) {
              const { error: rolloverErr } = await upsertAmtrRow(
                'amtr_1098_progress',
                { base_id: installationId, member_id: memberId, catalog_id: String(target.id), year_label: nextYear, next_due: nextDue },
                { onConflict: 'member_id,catalog_id,year_label' },
              )
              if (rolloverErr) { toast.error(rolloverErr); return }
            }
          }
        }
      }
    }
    onChange()
  }
  // Clear a manual due-date override and recompute from last_completed +
  // frequency. NAMT-only (gated at call site).
  const resetAutoDue = async (catId: string, freq: string) => {
    const existing = progByCat.get(catId)
    const recomputed = computeNextDue((existing?.last_completed as string) ?? '', freq)
    const { error } = await upsertAmtrRow(
      'amtr_1098_progress',
      { base_id: installationId, member_id: memberId, catalog_id: catId, year_label: year, next_due: recomputed, next_due_manual: false },
      { onConflict: 'member_id,catalog_id,year_label' },
    )
    if (error) { toast.error(error); return }
    onChange()
  }

  const kpi = { required: activeCatalog.length, complete: 0, dueSoon: 0, overdue: 0 }
  for (const c of activeCatalog) {
    const p = progByCat.get(String(c.id))
    const s = dueStatus({ dueDate: (p?.next_due as string) ?? null, completedDate: (p?.last_completed as string) ?? '' })
    if (s === 'complete') kpi.complete++; else if (s === 'due_soon') kpi.dueSoon++; else if (s === 'overdue') kpi.overdue++
  }
  type StatusFilter = 'complete' | 'due_soon' | 'overdue' | null
  const toggleFilter = (f: StatusFilter) => setStatusFilter((cur) => (cur === f ? null : f))
  const kpiCards: { label: string; value: number; color?: string; filter: StatusFilter; active: boolean }[] = [
    { label: 'Required', value: kpi.required, filter: null, active: statusFilter === null },
    { label: 'Complete', value: kpi.complete, color: 'var(--color-success)', filter: 'complete', active: statusFilter === 'complete' },
    { label: 'Due Soon', value: kpi.dueSoon, color: 'var(--color-warning)', filter: 'due_soon', active: statusFilter === 'due_soon' },
    { label: 'Overdue', value: kpi.overdue, color: 'var(--color-danger)', filter: 'overdue', active: statusFilter === 'overdue' },
  ]
  const visibleCatalog = statusFilter
    ? activeCatalog.filter((c) => {
        const p = progByCat.get(String(c.id))
        return dueStatus({ dueDate: (p?.next_due as string) ?? null, completedDate: (p?.last_completed as string) ?? '' }) === statusFilter
      })
    : activeCatalog

  return (
    <div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>DAF Form 1098 — Special Task Certification &amp; Recurring Training</h2>
      {isArchived && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6, fontSize: 'var(--fs-xs)', fontWeight: 700, background: 'color-mix(in srgb, var(--color-text-3) 18%, transparent)', color: 'var(--color-text-2)', border: '1px solid var(--color-border-mid)' }}>
          <Lock size={12} /> ARCHIVED — READ ONLY
        </span>
      )}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        {canManage && year !== currentYear && !isArchived && (
          <Btn variant="secondary" onClick={archiveYear} title="Archive this year — freezes all records (NAMT/AFM/Base Admin only)"><Archive size={14} /> Archive {year}</Btn>
        )}
        {canManage && isArchived && (
          <Btn variant="secondary" onClick={unarchiveYear} title="Unarchive — restores write access"><Archive size={14} /> Unarchive {year}</Btn>
        )}
        {canManageThisYear && <Btn variant="secondary" onClick={() => setEditMode(true)}><Pencil size={14} /> Edit {year} catalog</Btn>}
      </div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
      {kpiCards.map((k) => (
        <div key={k.label} className="card" onClick={() => toggleFilter(k.filter)}
          title={k.filter ? `Show only ${k.label.toLowerCase()} tasks` : 'Show all tasks'}
          style={{
            padding: '12px 16px', cursor: 'pointer',
            border: k.active ? `1.5px solid ${k.color ?? 'var(--color-accent)'}` : undefined,
            boxShadow: k.active ? `0 0 0 1px ${k.color ?? 'var(--color-accent)'}` : undefined,
          }}>
          <div className="section-label" style={{ marginBottom: 4 }}>{k.label}</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: k.color ?? 'var(--color-text-1)' }}>{k.value}</div>
        </div>
      ))}
    </div>
    <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      {years.map((y) => {
        const archived = !!yearRowByLabel.get(y)?.archived
        return (
          <button key={y} onClick={() => setYear(y)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: year === y ? 700 : 600, background: year === y ? 'var(--color-accent)' : 'var(--color-bg-inset)', color: year === y ? '#fff' : 'var(--color-text-2)' }}>
            {archived && <Lock size={11} />}
            {y}{y === currentYear ? ' (current)' : ''}
          </button>
        )
      })}
      {canManage && <button onClick={addYear} title="Add a prior year for transcription" style={{ padding: '5px 10px', borderRadius: 6, border: '1px dashed var(--color-border-mid)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)', background: 'transparent', color: 'var(--color-text-3)' }}>+ Add year</button>}
      {canManageThisYear && year !== currentYear && <button onClick={deleteYear} title="Delete this year's records" style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)', background: 'transparent', color: 'var(--color-danger)' }}>Delete {year}</button>}
      <span style={{ marginLeft: 8, fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
        {isArchived
          ? `This year is archived — records are read-only. Unarchive to enable editing.`
          : `Completing a task auto-creates next year's 1098. Catalog edits in ${year} don't affect other years.`}
      </span>
    </div>
    <div className="card" style={{ padding: 0, overflow: 'auto', position: 'relative', opacity: isArchived ? 0.55 : 1, transition: 'opacity 120ms ease' }}>
      {isArchived && (
        <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', background: 'repeating-linear-gradient(135deg, transparent 0 14px, color-mix(in srgb, var(--color-text-3) 6%, transparent) 14px 15px)' }} />
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
        <thead>
          <tr>
            <th style={thStyle}>Task</th><th style={thStyle}>Start</th>
            <th style={{ ...thStyle, whiteSpace: 'normal', width: 90 }}>Last<br />Completed</th>
            <th style={thStyle}>Trainee</th><th style={{ ...thStyle, whiteSpace: 'normal', width: 64 }}>Cert<br />Official</th>
            <th style={thStyle}>Score/Hrs</th><th style={thStyle}>Type</th><th style={thStyle}>Freq</th>
            <th style={thStyle}>Due</th><th style={thStyle}>Status</th>
          </tr>
        </thead>
        <tbody>
          {visibleCatalog.length === 0 && (
            <tr><td colSpan={10} style={{ ...tdStyle, color: 'var(--color-text-3)', textAlign: 'center' }}>No {statusFilter === 'due_soon' ? 'due soon' : statusFilter} tasks.</td></tr>
          )}
          {visibleCatalog.map((c) => {
            const catId = String(c.id)
            const p = progByCat.get(catId)
            const freq = String(c.frequency ?? 'Annual')
            const last = (p?.last_completed as string) ?? ''
            const next = (p?.next_due as string) ?? null
            const status = dueStatus({ dueDate: next, completedDate: last })
            const hi = highlightItem === catId
            const signCell = (slot: SignSlot) => (
              <td style={tdStyle}>
                <SignCell value={(p?.[`${slot}_initials`] as string) ?? null}
                  canSign={canWrite && !isArchived && canSignSlot(myRoles, slot, isOwn)}
                  canReopenSlot={reopenAllowed && !!p?.[`${slot}_signed_by`]}
                  onReopen={() => p?.id && reopen('amtr_1098_progress', String(p.id), slot)}
                  onSign={async () => {
                    const rid = await ensure(catId); if (!rid) return
                    await sign('amtr_1098_progress', rid, slot, async () => {
                      if (slot !== 'trainee' && member.user_id) {
                        const draft: NotificationDraft = buildSignoff(member.full_name, slot as AmtrRole, 'DAF 1098', String(c.task), catId, '1098')
                        await createAmtrNotification({ base_id: installationId, recipient_user_id: member.user_id, member_id: memberId, ...draft })
                      }
                    }, {
                      kind: '1098',
                      label: String(c.task ?? ''),
                      // DAF 1098 always carries a Certifying Official
                      // column on the form — every recurring item
                      // expects a certifier sign-off.
                      requiresCertifier: true,
                      // Pass catalog/progress data so the dialog can
                      // pre-fill the Monthly Proficiency template
                      // (date / type / frequency / score-or-hours).
                      extra: {
                        type: c.type ? String(c.type) : '',
                        frequency: c.frequency ? String(c.frequency) : '',
                        score_or_hours: c.score_or_hours ? String(c.score_or_hours) : '',
                        last_completed: p?.last_completed ? String(p.last_completed) : '',
                      },
                    })
                  }} />
              </td>
            )
            const isManualDue = !!p?.next_due_manual
            return (
              <tr key={catId} data-amtr-item={catId} style={{ borderBottom: '1px solid var(--color-border)', background: hi ? 'var(--color-accent-glow)' : undefined }}>
                <td style={tdStyle}>
                  <button onClick={() => setResourceFor(c)} title="Training resources"
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-1)', fontFamily: 'inherit', fontSize: 'inherit', textAlign: 'left', display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <span>{String(c.task)}</span>
                    <BookOpen size={13} style={{ color: (resources.get(catId)?.length ?? 0) > 0 ? 'var(--color-accent)' : 'var(--color-text-3)', flexShrink: 0 }} />
                  </button>
                </td>
                <td style={tdStyle}><input type="date" className="input-dark" style={di} disabled={!canEditThisYear} defaultValue={p?.start_date ? String(p.start_date).slice(0, 10) : ''} onBlur={(e) => canEditThisYear && setField(catId, freq, 'start_date', e.target.value)} /></td>
                <td style={tdStyle}><input type="date" className="input-dark" style={di} disabled={!canEditThisYear} defaultValue={last ? last.slice(0, 10) : ''} onBlur={(e) => canEditThisYear && setField(catId, freq, 'last_completed', e.target.value)} /></td>
                {signCell('trainee')}{signCell('certifier')}
                <td style={tdStyle}>{c.score_or_hours ? String(c.score_or_hours) : '—'}</td>
                <td style={tdStyle}>{c.type ? String(c.type) : '—'}</td>
                <td style={tdStyle}>{freq}</td>
                <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                  {canManageThisYear ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <input
                        key={`${catId}-${next ?? ''}-${isManualDue}`}
                        type="date"
                        className="input-dark"
                        style={di}
                        defaultValue={next ? String(next).slice(0, 10) : ''}
                        title={isManualDue ? 'Manual override — won\'t auto-recompute on completion' : 'Auto-computed from last completed + frequency'}
                        onBlur={(e) => setField(catId, freq, 'next_due', e.target.value)}
                      />
                      {isManualDue && (
                        <button onClick={() => resetAutoDue(catId, freq)} title="Clear manual override and recompute from frequency"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-warning)', padding: 1, display: 'inline-flex' }}><RotateCcw size={12} /></button>
                      )}
                    </span>
                  ) : (
                    <>{next ? String(next).slice(0, 10) : '—'}{isManualDue && <span title="Manually set due date" style={{ marginLeft: 4, fontSize: 'var(--fs-xs)', color: 'var(--color-warning)' }}>*</span>}</>
                  )}
                </td>
                <td style={tdStyle}><StatusPill status={status} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
    {resourceFor && (
      <ResourceDialog catalogId={String(resourceFor.id)} taskLabel={String(resourceFor.task)} installationId={installationId} canManage={canManage}
        onClose={() => setResourceFor(null)} onChanged={loadResources} />
    )}
    </div>
  )
}

const di: React.CSSProperties = { padding: '3px 6px', fontSize: 'var(--fs-xs)', width: 130 }

// Per-task training resources — view links; NAMT (canManage) can add/edit/remove.
