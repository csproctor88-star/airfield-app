'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useInstallation } from '@/lib/installation-context'
import { fetchContractors, createContractor, updateContractor, type ContractorRow } from '@/lib/supabase/contractors'
import { CONTRACTOR_STATUS_CONFIG } from '@/lib/constants'
import { DEMO_CONTRACTORS } from '@/lib/demo-data'
import { toast } from 'sonner'
import { formatZuluDate } from '@/lib/utils'

type FilterTab = 'active' | 'all' | 'completed'

export default function ContractorsPage() {
  const { installationId } = useInstallation()
  const [contractors, setContractors] = useState<ContractorRow[]>([])
  const [filter, setFilter] = useState<FilterTab>('active')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formCompany, setFormCompany] = useState('')
  const [formContact, setFormContact] = useState('')
  const [formLocation, setFormLocation] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split('T')[0])
  const [formNotes, setFormNotes] = useState('')
  const [formRadio, setFormRadio] = useState('')
  const [formFlag, setFormFlag] = useState('')
  const [formCallsign, setFormCallsign] = useState('')

  // Edit state
  const [editCompany, setEditCompany] = useState('')
  const [editContact, setEditContact] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editStartDate, setEditStartDate] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editRadio, setEditRadio] = useState('')
  const [editFlag, setEditFlag] = useState('')
  const [editCallsign, setEditCallsign] = useState('')

  const loadContractors = useCallback(async () => {
    const supabase = createClient()
    if (!supabase) {
      setContractors(DEMO_CONTRACTORS as ContractorRow[])
      return
    }
    const data = await fetchContractors(installationId)
    setContractors(data)
  }, [installationId])

  useEffect(() => { loadContractors() }, [loadContractors])

  const filtered = contractors.filter(c => {
    if (filter === 'active' && c.status !== 'active') return false
    if (filter === 'completed' && c.status !== 'completed') return false
    if (search) {
      const q = search.toLowerCase()
      return (
        c.company_name.toLowerCase().includes(q) ||
        (c.contact_name || '').toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q)
      )
    }
    return true
  })

  const activeCount = contractors.filter(c => c.status === 'active').length

  function resetForm() {
    setFormCompany('')
    setFormContact('')
    setFormLocation('')
    setFormDescription('')
    setFormStartDate(new Date().toISOString().split('T')[0])
    setFormNotes('')
    setFormRadio('')
    setFormFlag('')
    setFormCallsign('')
  }

  async function handleCreate() {
    if (!formCompany.trim() || !formLocation.trim() || !formDescription.trim()) {
      toast.error('Company/name, location, and work description are required')
      return
    }
    setSaving(true)
    const { error } = await createContractor({
      company_name: formCompany.trim(),
      contact_name: formContact.trim() || undefined,
      location: formLocation.trim(),
      work_description: formDescription.trim(),
      start_date: formStartDate,
      notes: formNotes.trim() || undefined,
      radio_number: formRadio.trim() || undefined,
      flag_number: formFlag.trim() || undefined,
      callsign: formCallsign.trim() || undefined,
      base_id: installationId,
    })
    setSaving(false)
    if (error) {
      toast.error(error)
      return
    }
    toast.success('Personnel added')
    resetForm()
    setShowForm(false)
    loadContractors()
  }

  async function handleMarkCompleted(id: string) {
    setSaving(true)
    const { error } = await updateContractor(id, { status: 'completed' })
    setSaving(false)
    if (error) {
      toast.error(error)
      return
    }
    toast.success('Marked as completed')
    loadContractors()
  }

  function startEdit(c: ContractorRow) {
    setEditingId(c.id)
    setEditCompany(c.company_name)
    setEditContact(c.contact_name || '')
    setEditLocation(c.location)
    setEditDescription(c.work_description)
    setEditStartDate(c.start_date)
    setEditNotes(c.notes || '')
    setEditRadio(c.radio_number || '')
    setEditFlag(c.flag_number || '')
    setEditCallsign(c.callsign || '')
  }

  async function handleSaveEdit(id: string) {
    if (!editCompany.trim() || !editLocation.trim() || !editDescription.trim()) {
      toast.error('Company name, location, and work description are required')
      return
    }
    setSaving(true)
    const { error } = await updateContractor(id, {
      company_name: editCompany.trim(),
      contact_name: editContact.trim() || null,
      location: editLocation.trim(),
      work_description: editDescription.trim(),
      start_date: editStartDate,
      notes: editNotes.trim() || null,
      radio_number: editRadio.trim() || null,
      flag_number: editFlag.trim() || null,
      callsign: editCallsign.trim() || null,
    })
    setSaving(false)
    if (error) {
      toast.error(error)
      return
    }
    toast.success('Personnel updated')
    setEditingId(null)
    loadContractors()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid var(--color-border)',
    background: 'var(--color-bg-surface)',
    color: 'var(--color-text-1)',
    fontSize: 'var(--fs-base)',
    fontFamily: 'inherit',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--fs-sm)',
    fontWeight: 600,
    color: 'var(--color-text-2)',
    marginBottom: 4,
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 16px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ fontSize: 'var(--fs-3xl)', fontWeight: 700, color: 'var(--color-text-1)', margin: 0 }}>
            Personnel on Airfield
          </h1>
          {activeCount > 0 && (
            <span style={{
              background: '#D1FAE5',
              color: '#22C55E',
              fontSize: 'var(--fs-sm)',
              fontWeight: 700,
              padding: '2px 10px',
              borderRadius: 12,
            }}>
              {activeCount} Active
            </span>
          )}
        </div>
        <button
          onClick={() => { setShowForm(prev => !prev); if (showForm) resetForm() }}
          style={{
            background: showForm ? 'var(--color-border)' : 'var(--color-cyan)',
            color: showForm ? 'var(--color-text-1)' : '#000',
            border: 'none',
            borderRadius: 8,
            padding: '8px 16px',
            fontWeight: 700,
            fontSize: 'var(--fs-base)',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {showForm ? 'Cancel' : '+ Add Personnel'}
        </button>
      </div>

      {/* Add Contractor Form */}
      {showForm && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 12 }}>
            New Personnel Entry
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={labelStyle}>Company Name *</div>
              <input value={formCompany} onChange={e => setFormCompany(e.target.value)} placeholder="e.g. Kiewit Infrastructure" style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>Contact Name</div>
              <input value={formContact} onChange={e => setFormContact(e.target.value)} placeholder="e.g. John Smith" style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>Location *</div>
              <input value={formLocation} onChange={e => setFormLocation(e.target.value)} placeholder="e.g. TWY A/B Intersection" style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>Start Date</div>
              <input type="date" value={formStartDate} onChange={e => setFormStartDate(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={labelStyle}>Work Description *</div>
              <input value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="e.g. Joint sealing and pavement repair" style={inputStyle} />
            </div>
            <div style={{ gridColumn: '1 / -1', height: 1, background: 'var(--color-border)', margin: '4px 0' }} />
            <div>
              <div style={labelStyle}>Radio Number Issued</div>
              <input value={formRadio} onChange={e => setFormRadio(e.target.value)} placeholder="e.g. Radio 12" style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>Callsign</div>
              <input value={formCallsign} onChange={e => setFormCallsign(e.target.value)} placeholder="e.g. Bravo-1" style={inputStyle} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={labelStyle}>Flag Number Issued (Vehicle Escort)</div>
              <input value={formFlag} onChange={e => setFormFlag(e.target.value)} placeholder="e.g. Flag 3" style={inputStyle} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={labelStyle}>Notes</div>
              <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Additional details..." rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button
              onClick={handleCreate}
              disabled={saving}
              style={{
                background: 'var(--color-cyan)',
                color: '#000',
                border: 'none',
                borderRadius: 8,
                padding: '8px 20px',
                fontWeight: 700,
                fontSize: 'var(--fs-base)',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
                fontFamily: 'inherit',
              }}
            >
              {saving ? 'Saving...' : 'Add Personnel'}
            </button>
          </div>
        </div>
      )}

      {/* Filters + Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        {(['active', 'all', 'completed'] as FilterTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            style={{
              background: filter === tab ? 'var(--color-cyan)' : 'var(--color-bg-surface)',
              color: filter === tab ? '#000' : 'var(--color-text-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              padding: '6px 14px',
              fontWeight: 600,
              fontSize: 'var(--fs-sm)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search personnel..."
          style={{ ...inputStyle, flex: 1, minWidth: 180 }}
        />
      </div>

      {/* Contractor List */}
      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 'var(--fs-lg)', color: 'var(--color-text-3)' }}>
            {search ? 'No personnel match your search' : filter === 'active' ? 'No active personnel' : 'No personnel found'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(c => {
            const cfg = CONTRACTOR_STATUS_CONFIG[c.status]
            const isEditing = editingId === c.id
            const daysSinceStart = Math.max(1, Math.ceil((Date.now() - new Date(c.start_date).getTime()) / 86400000))

            return (
              <div key={c.id} className="card" style={{ padding: 14 }}>
                {isEditing ? (
                  /* Edit mode */
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <div style={labelStyle}>Company Name *</div>
                        <input value={editCompany} onChange={e => setEditCompany(e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <div style={labelStyle}>Contact Name</div>
                        <input value={editContact} onChange={e => setEditContact(e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <div style={labelStyle}>Location *</div>
                        <input value={editLocation} onChange={e => setEditLocation(e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <div style={labelStyle}>Start Date</div>
                        <input type="date" value={editStartDate} onChange={e => setEditStartDate(e.target.value)} style={inputStyle} />
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <div style={labelStyle}>Work Description *</div>
                        <input value={editDescription} onChange={e => setEditDescription(e.target.value)} style={inputStyle} />
                      </div>
                      <div style={{ gridColumn: '1 / -1', height: 1, background: 'var(--color-border)', margin: '4px 0' }} />
                      <div>
                        <div style={labelStyle}>Radio Number Issued</div>
                        <input value={editRadio} onChange={e => setEditRadio(e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <div style={labelStyle}>Callsign</div>
                        <input value={editCallsign} onChange={e => setEditCallsign(e.target.value)} style={inputStyle} />
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <div style={labelStyle}>Flag Number Issued (Vehicle Escort)</div>
                        <input value={editFlag} onChange={e => setEditFlag(e.target.value)} style={inputStyle} />
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <div style={labelStyle}>Notes</div>
                        <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
                      <button
                        onClick={() => setEditingId(null)}
                        style={{ background: 'var(--color-border)', color: 'var(--color-text-1)', border: 'none', borderRadius: 8, padding: '6px 14px', fontWeight: 600, fontSize: 'var(--fs-sm)', cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveEdit(c.id)}
                        disabled={saving}
                        style={{ background: 'var(--color-cyan)', color: '#000', border: 'none', borderRadius: 8, padding: '6px 14px', fontWeight: 700, fontSize: 'var(--fs-sm)', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, fontFamily: 'inherit' }}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View mode */
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)' }}>
                            {c.company_name}
                          </span>
                          <span style={{
                            fontSize: 'var(--fs-2xs)',
                            fontWeight: 700,
                            color: cfg.color,
                            background: cfg.bg,
                            padding: '1px 8px',
                            borderRadius: 8,
                          }}>
                            {cfg.label}
                          </span>
                          {c.status === 'active' && (
                            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600 }}>
                              Day {daysSinceStart}
                            </span>
                          )}
                        </div>
                        {c.contact_name && (
                          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', marginBottom: 2 }}>
                            Contact: {c.contact_name}
                          </div>
                        )}
                        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>
                          <strong>Location:</strong> {c.location}
                        </div>
                        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>
                          <strong>Work:</strong> {c.work_description}
                        </div>
                        {(c.radio_number || c.callsign || c.flag_number) && (
                          <div style={{ display: 'flex', gap: 16, fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', marginTop: 2, flexWrap: 'wrap' }}>
                            {c.radio_number && <span><strong>Radio:</strong> {c.radio_number}</span>}
                            {c.callsign && <span><strong>Callsign:</strong> {c.callsign}</span>}
                            {c.flag_number && <span><strong>Flag:</strong> {c.flag_number}</span>}
                          </div>
                        )}
                        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 4 }}>
                          Started: {formatZuluDate(new Date(c.start_date))}
                          {c.end_date && (
                            <> &middot; Ended: {formatZuluDate(new Date(c.end_date))}</>
                          )}
                        </div>
                        {c.notes && (
                          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontStyle: 'italic', marginTop: 4 }}>
                            {c.notes}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button
                          onClick={() => startEdit(c)}
                          style={{ background: 'var(--color-bg-surface)', color: 'var(--color-cyan)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '6px 12px', fontWeight: 600, fontSize: 'var(--fs-sm)', cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          Edit
                        </button>
                        {c.status === 'active' && (
                          <button
                            onClick={() => handleMarkCompleted(c.id)}
                            disabled={saving}
                            style={{ background: 'var(--color-success)', color: '#000', border: 'none', borderRadius: 8, padding: '6px 12px', fontWeight: 700, fontSize: 'var(--fs-sm)', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, fontFamily: 'inherit' }}
                          >
                            Mark Completed
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
