'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { useInstallation } from '@/lib/installation-context'
import { createClient } from '@/lib/supabase/client'
import { formatZuluDate } from '@/lib/utils'
import {
  fetchPprColumns,
  fetchPprEntries,
  createPprEntry,
  updatePprEntry,
  deletePprEntry,
  type PprColumn,
  type PprEntry,
} from '@/lib/supabase/ppr'

export default function PprPage() {
  const { installationId } = useInstallation()

  const [columns, setColumns] = useState<PprColumn[]>([])
  const [entries, setEntries] = useState<PprEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [userOI, setUserOI] = useState('')

  // Date filter
  const today = new Date().toISOString().slice(0, 10)
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)
  const [dateMode, setDateMode] = useState<'today' | '7d' | '30d' | 'custom'>('today')

  // Create/Edit modal
  const [showModal, setShowModal] = useState(false)
  const [editingEntry, setEditingEntry] = useState<PprEntry | null>(null)
  const [formDate, setFormDate] = useState(today)
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [formNotes, setFormNotes] = useState('')

  // Load current user's operating initials
  useEffect(() => {
    async function loadOI() {
      const supabase = createClient()
      if (!supabase) return
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await (supabase as any).from('profiles').select('operating_initials').eq('id', user.id).single()
      if (data?.operating_initials) setUserOI(data.operating_initials)
    }
    loadOI()
  }, [])

  // Load columns + entries
  const loadData = useCallback(async () => {
    if (!installationId) return
    setLoading(true)
    const [cols, ents] = await Promise.all([
      fetchPprColumns(installationId),
      fetchPprEntries(installationId, dateFrom, dateTo),
    ])
    setColumns(cols)
    setEntries(ents)
    setLoading(false)
  }, [installationId, dateFrom, dateTo])

  useEffect(() => { loadData() }, [loadData])

  // Date mode changes
  useEffect(() => {
    const now = new Date()
    if (dateMode === 'today') {
      const d = now.toISOString().slice(0, 10)
      setDateFrom(d)
      setDateTo(d)
    } else if (dateMode === '7d') {
      const from = new Date(now.getTime() - 6 * 86400000).toISOString().slice(0, 10)
      setDateFrom(from)
      setDateTo(now.toISOString().slice(0, 10))
    } else if (dateMode === '30d') {
      const from = new Date(now.getTime() - 29 * 86400000).toISOString().slice(0, 10)
      setDateFrom(from)
      setDateTo(now.toISOString().slice(0, 10))
    }
  }, [dateMode])

  // Open create modal
  const handleNew = () => {
    setEditingEntry(null)
    setFormDate(today)
    setFormValues({})
    setFormNotes('')
    setShowModal(true)
  }

  // Open edit modal
  const handleEdit = (entry: PprEntry) => {
    setEditingEntry(entry)
    setFormDate(entry.arrival_date)
    setFormValues(entry.column_values || {})
    setFormNotes(entry.notes || '')
    setShowModal(true)
  }

  // Save (create or update)
  const handleSave = async () => {
    if (!installationId) return

    if (editingEntry) {
      const updated = await updatePprEntry(editingEntry.id, {
        arrival_date: formDate,
        column_values: formValues,
        notes: formNotes.trim() || undefined,
      }, installationId)
      if (updated) {
        toast.success('PPR updated')
        setShowModal(false)
        loadData()
      }
    } else {
      if (!userOI) {
        toast.error('Set your Operating Initials in Settings before creating PPRs')
        return
      }
      const entry = await createPprEntry({
        base_id: installationId,
        arrival_date: formDate,
        column_values: formValues,
        notes: formNotes.trim() || undefined,
        approver_oi: userOI,
      })
      if (entry) {
        toast.success(`PPR ${entry.ppr_number} created`)
        setShowModal(false)
        loadData()
      }
    }
  }

  // Delete
  const handleDelete = async (entry: PprEntry) => {
    if (!confirm(`Delete PPR ${entry.ppr_number}?`)) return
    const ok = await deletePprEntry(entry.id, entry.ppr_number, installationId || undefined)
    if (ok) {
      toast.success('PPR deleted')
      loadData()
    }
  }

  const noColumns = columns.length === 0

  return (
    <div className="page-container" style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 'var(--fs-3xl)', fontWeight: 700, color: 'var(--color-text-1)', margin: 0 }}>
          Prior Permission Required
        </h1>
        <button
          onClick={handleNew}
          disabled={noColumns}
          title={noColumns ? 'Configure PPR columns in Base Setup first' : 'New PPR'}
          style={{
            padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
            background: noColumns ? 'var(--color-border)' : 'linear-gradient(135deg, #0369A1, var(--color-accent-secondary))',
            color: noColumns ? 'var(--color-text-3)' : '#fff',
            cursor: noColumns ? 'not-allowed' : 'pointer', fontSize: 'var(--fs-md)', fontWeight: 700, fontFamily: 'inherit',
          }}
        >
          + New PPR
        </button>
      </div>

      {noColumns && (
        <div className="card" style={{ padding: 20, textAlign: 'center', marginBottom: 16 }}>
          <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-md)', margin: '0 0 8px' }}>
            No PPR columns configured for this installation.
          </p>
          <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', margin: 0 }}>
            Go to Settings &rarr; Base Configuration &rarr; Step 14 (PPR Columns) to set up your PPR fields.
          </p>
        </div>
      )}

      {/* Date filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {(['today', '7d', '30d', 'custom'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => setDateMode(mode)}
            style={{
              padding: '5px 12px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-sm)', fontWeight: 600,
              border: `1px solid ${dateMode === mode ? 'var(--color-accent)' : 'var(--color-border)'}`,
              background: dateMode === mode ? 'rgba(56,189,248,0.08)' : 'var(--color-bg)',
              color: dateMode === mode ? 'var(--color-accent)' : 'var(--color-text-3)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {mode === 'today' ? 'Today' : mode === '7d' ? '7 Days' : mode === '30d' ? '30 Days' : 'Custom'}
          </button>
        ))}
        {dateMode === 'custom' && (
          <>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              style={{
                padding: '4px 8px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)',
              }}
            />
            <span style={{ color: 'var(--color-text-3)' }}>to</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              style={{
                padding: '4px 8px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)',
              }}
            />
          </>
        )}
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginLeft: 4 }}>
          {entries.length} PPR{entries.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* PPR Table */}
      {loading ? (
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-3)' }}>Loading...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-md)' }}>No PPRs for this date range.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg-inset)', borderBottom: '2px solid var(--color-border)' }}>
                <th style={thStyle}>PPR #</th>
                <th style={thStyle}>Date</th>
                {columns.map(col => (
                  <th key={col.id} style={thStyle}>{col.column_name}</th>
                ))}
                <th style={thStyle}>Notes</th>
                <th style={{ ...thStyle, width: 70 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <tr key={entry.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 700, color: 'var(--color-accent)', fontFamily: 'monospace' }}>
                      {entry.ppr_number}
                    </span>
                  </td>
                  <td style={tdStyle}>{formatZuluDate(entry.arrival_date + 'T00:00:00Z')}</td>
                  {columns.map(col => (
                    <td key={col.id} style={tdStyle}>
                      {(entry.column_values || {})[col.id] || '—'}
                    </td>
                  ))}
                  <td style={{ ...tdStyle, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.notes || '—'}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => handleEdit(entry)}
                        style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', fontSize: 'var(--fs-sm)', fontWeight: 600, padding: '2px 4px' }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(entry)}
                        style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 'var(--fs-sm)', fontWeight: 600, padding: '2px 4px' }}
                      >
                        Del
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            width: 480, maxHeight: '85vh', overflow: 'auto',
            background: 'var(--color-bg-surface)', borderRadius: 8,
            border: '1px solid var(--color-border)', padding: 20,
          }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 'var(--fs-lg)', color: 'var(--color-text-1)' }}>
              {editingEntry ? `Edit PPR ${editingEntry.ppr_number}` : 'New PPR'}
            </h3>
            {!editingEntry && (
              <p style={{ margin: '0 0 12px', fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
                PPR # will be auto-generated: {'{julian_day}'}-{'{seq}'}-{userOI || '??'}
              </p>
            )}

            {/* Arrival Date */}
            <label style={{ display: 'block', fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 10 }}>
              Arrival Date *
              <input
                type="date"
                value={formDate}
                onChange={e => setFormDate(e.target.value)}
                style={{
                  display: 'block', width: '100%', padding: '6px 10px', borderRadius: 4, marginTop: 4,
                  border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                  color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)',
                }}
              />
            </label>

            {/* Dynamic columns */}
            {columns.map(col => (
              <label key={col.id} style={{ display: 'block', fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 10 }}>
                {col.column_name}{col.is_required ? ' *' : ''}
                <input
                  value={formValues[col.id] || ''}
                  onChange={e => setFormValues(prev => ({ ...prev, [col.id]: e.target.value }))}
                  style={{
                    display: 'block', width: '100%', padding: '6px 10px', borderRadius: 4, marginTop: 4,
                    border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                    color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)',
                  }}
                />
              </label>
            ))}

            {/* Notes */}
            <label style={{ display: 'block', fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 16 }}>
              Notes
              <textarea
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                rows={2}
                style={{
                  display: 'block', width: '100%', padding: '6px 10px', borderRadius: 4, marginTop: 4,
                  border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                  color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', resize: 'vertical',
                }}
              />
            </label>

            {/* Approver info */}
            {!editingEntry && (
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginBottom: 12, padding: '6px 10px', background: 'var(--color-bg-inset)', borderRadius: 4 }}>
                Approved by: <strong style={{ color: 'var(--color-text-1)' }}>{userOI || 'No OI set'}</strong>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowModal(false)}
                style={{ padding: '6px 16px', borderRadius: 4, background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-3)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!formDate || (!editingEntry && !userOI)}
                style={{
                  padding: '6px 16px', borderRadius: 4, border: 'none', cursor: 'pointer',
                  background: formDate ? 'var(--color-accent)' : 'var(--color-border)',
                  color: formDate ? '#fff' : 'var(--color-text-3)',
                  fontWeight: 500,
                }}
              >
                {editingEntry ? 'Save Changes' : 'Approve PPR'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Table styles ──

const thStyle: React.CSSProperties = {
  padding: '8px 10px', textAlign: 'left', fontWeight: 700,
  color: 'var(--color-text-3)', fontSize: 'var(--fs-xs)',
  textTransform: 'uppercase', letterSpacing: '0.04em',
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '8px 10px', color: 'var(--color-text-1)',
  whiteSpace: 'nowrap',
}
