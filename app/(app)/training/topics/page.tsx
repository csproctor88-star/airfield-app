'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, BookOpen, Pencil, Plus, X, ExternalLink, Info } from 'lucide-react'
import { toast } from 'sonner'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions } from '@/lib/permissions'
import {
  fetchTrainingTopics,
  createCustomTopic,
  createTopicOverride,
  updateTopic,
  type TrainingTopic,
} from '@/lib/supabase/training-part139'

/**
 * /training/topics — catalog of §139.303(e) topics plus base-custom topics.
 *
 * System topics (base_id = NULL) are read-only seed rows; clicking
 * Edit on a system row opens the modal pre-filled and creates a
 * base-specific override row on save. Base rows can be edited or
 * soft-deleted (active = false) in place.
 */
export default function TrainingTopicsPage() {
  const { installationId } = useInstallation()
  const { has } = usePermissions()
  const canWrite = has('training_part139:write')

  const [topics, setTopics] = useState<TrainingTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<TrainingTopic | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    if (!installationId) return
    setLoading(true)
    const rows = await fetchTrainingTopics(installationId)
    // Collapse base override + system row to whichever takes precedence
    // (base row wins). Then sort by sort_order.
    const byCode = new Map<string, TrainingTopic>()
    for (const t of rows) {
      const prior = byCode.get(t.code)
      if (!prior || (t.base_id && !prior.base_id)) byCode.set(t.code, t)
    }
    setTopics(Array.from(byCode.values()).sort((a, b) => a.sort_order - b.sort_order))
    setLoading(false)
  }, [installationId])

  useEffect(() => { void load() }, [load])

  return (
    <div className="page-container" style={{ maxWidth: 1100 }}>
      <Link href="/training" style={backLinkStyle}>
        <ArrowLeft size={14} /> Training Overview
      </Link>

      <div style={headerRowStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BookOpen size={20} color="var(--color-cyan)" />
          <div>
            <div style={titleStyle}>Training Topics</div>
            <div style={subtitleStyle}>
              13 system topics from 14 CFR §139.303(e) plus your base-specific custom topics
            </div>
          </div>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            style={primaryBtnStyle}
          >
            <Plus size={14} /> Add Custom Topic
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ color: 'var(--color-text-3)', padding: 24, textAlign: 'center' }}>Loading…</div>
      ) : topics.length === 0 ? (
        <div style={emptyStateStyle}>
          <Info size={16} /> No topics visible. Confirm your base type is FAA Part 139 and you hold
          training_part139:read.
        </div>
      ) : (
        <div style={tableWrapStyle}>
          <div style={tableHeaderStyle}>
            <div style={{ flex: '0 0 110px' }}>Code</div>
            <div style={{ flex: 1 }}>Title</div>
            <div style={{ flex: '0 0 110px' }}>Recurrent</div>
            <div style={{ flex: '0 0 110px' }}>Retention</div>
            <div style={{ flex: '0 0 70px', textAlign: 'right' }}></div>
          </div>
          {topics.map(t => (
            <div key={t.id} style={tableRowStyle}>
              <div style={{ flex: '0 0 110px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <code style={codeStyle}>{t.code}</code>
                {t.base_id && <BaseBadge />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: 'var(--color-text-1)' }}>{t.title}</div>
                {t.description && (
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2, lineHeight: 1.4 }}>
                    {t.description}
                  </div>
                )}
                {t.material_url && (
                  <a
                    href={t.material_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={materialLinkStyle}
                  >
                    <ExternalLink size={11} /> Reference material
                  </a>
                )}
              </div>
              <div style={{ flex: '0 0 110px', color: 'var(--color-text-2)' }}>
                {t.recurrent_frequency_months} mo
              </div>
              <div style={{ flex: '0 0 110px', color: 'var(--color-text-2)' }}>
                {t.retention_months} mo
              </div>
              <div style={{ flex: '0 0 70px', textAlign: 'right' }}>
                {canWrite && (
                  <button
                    type="button"
                    onClick={() => setEditing(t)}
                    style={iconBtnStyle}
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && installationId && (
        <EditModal
          topic={editing}
          baseId={installationId}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load() }}
        />
      )}
      {creating && installationId && (
        <CreateModal
          baseId={installationId}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); void load() }}
        />
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Edit modal — handles both base rows (in-place update) and system
// rows (creates a base override on save)
// ────────────────────────────────────────────────────────────────
function EditModal({
  topic, baseId, onClose, onSaved,
}: {
  topic: TrainingTopic
  baseId: string
  onClose: () => void
  onSaved: () => void
}) {
  const isSystem = topic.base_id === null
  const [freq, setFreq] = useState(String(topic.recurrent_frequency_months))
  const [retention, setRetention] = useState(String(topic.retention_months))
  const [materialUrl, setMaterialUrl] = useState(topic.material_url ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const updates = {
      recurrent_frequency_months: parseInt(freq, 10) || 12,
      retention_months: parseInt(retention, 10) || 24,
      material_url: materialUrl.trim() || null,
    }
    const result = isSystem
      ? await createTopicOverride(topic.id, baseId, updates)
      : await updateTopic(topic.id, baseId, updates)
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error ?? 'Save failed')
      return
    }
    toast.success(isSystem ? 'Base override created' : 'Topic updated')
    onSaved()
  }

  return (
    <ModalShell title={`Edit ${topic.code}`} onClose={onClose}>
      {isSystem && (
        <div style={hintBoxStyle}>
          <Info size={14} />
          <div>
            This is a system topic. Saving creates a base-specific override —
            the system row stays unchanged. Future system updates won't overwrite
            your base values.
          </div>
        </div>
      )}
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Title</label>
        <div style={readOnlyValueStyle}>{topic.title}</div>
      </div>
      <div style={fieldRowStyle}>
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Recurrent frequency (months)</label>
          <input
            type="number"
            min={1}
            max={120}
            value={freq}
            onChange={e => setFreq(e.target.value)}
            style={inputStyle}
          />
          <div style={fieldHintStyle}>§139.303 typically operates on a 12-month recurrent cadence.</div>
        </div>
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Retention (months past completion)</label>
          <input
            type="number"
            min={24}
            max={120}
            value={retention}
            onChange={e => setRetention(e.target.value)}
            style={inputStyle}
          />
          <div style={fieldHintStyle}>FAA minimum: 24 months past most recent completion.</div>
        </div>
      </div>
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Reference material URL (optional)</label>
        <input
          type="url"
          value={materialUrl}
          onChange={e => setMaterialUrl(e.target.value)}
          placeholder="https://..."
          style={inputStyle}
        />
        <div style={fieldHintStyle}>Link to a slide deck, LMS module, or printed handout.</div>
      </div>
      <ModalActions saving={saving} onCancel={onClose} onSave={handleSave} />
    </ModalShell>
  )
}

// ────────────────────────────────────────────────────────────────
// Create modal — for custom topics outside the 13 §139.303(e) list
// ────────────────────────────────────────────────────────────────
function CreateModal({
  baseId, onClose, onCreated,
}: {
  baseId: string
  onClose: () => void
  onCreated: () => void
}) {
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [freq, setFreq] = useState('12')
  const [retention, setRetention] = useState('24')
  const [materialUrl, setMaterialUrl] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!code.trim() || !title.trim()) {
      toast.error('Code and title are required')
      return
    }
    setSaving(true)
    const result = await createCustomTopic({
      base_id: baseId,
      code: code.trim(),
      title: title.trim(),
      description: description.trim() || null,
      recurrent_frequency_months: parseInt(freq, 10) || 12,
      retention_months: parseInt(retention, 10) || 24,
      material_url: materialUrl.trim() || null,
    })
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error ?? 'Create failed')
      return
    }
    toast.success('Custom topic added')
    onCreated()
  }

  return (
    <ModalShell title="Add Custom Topic" onClose={onClose}>
      <div style={hintBoxStyle}>
        <Info size={14} />
        <div>
          Custom topics supplement the 13 §139.303(e) topics for base-specific
          training needs (e.g. local snow-removal SOPs, ARFF coordination drills).
        </div>
      </div>
      <div style={fieldRowStyle}>
        <div style={{ ...fieldGroupStyle, flex: '0 0 200px' }}>
          <label style={labelStyle}>Code *</label>
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="e.g. BASE-001"
            style={inputStyle}
          />
        </div>
        <div style={{ ...fieldGroupStyle, flex: 1 }}>
          <label style={labelStyle}>Title *</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Local snow-removal coordination"
            style={inputStyle}
          />
        </div>
      </div>
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>
      <div style={fieldRowStyle}>
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Recurrent (months)</label>
          <input
            type="number" min={1} max={120}
            value={freq}
            onChange={e => setFreq(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Retention (months)</label>
          <input
            type="number" min={24} max={120}
            value={retention}
            onChange={e => setRetention(e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Reference material URL</label>
        <input
          type="url"
          value={materialUrl}
          onChange={e => setMaterialUrl(e.target.value)}
          placeholder="https://..."
          style={inputStyle}
        />
      </div>
      <ModalActions saving={saving} onCancel={onClose} onSave={handleSave} />
    </ModalShell>
  )
}

// ────────────────────────────────────────────────────────────────
// Reusable modal pieces
// ────────────────────────────────────────────────────────────────
function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-overlay" style={{ zIndex: 'var(--z-modal)' }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-bg-elevated)',
          borderRadius: 'var(--radius-lg)',
          padding: 20,
          width: '90vw',
          maxWidth: 560,
          maxHeight: '85vh',
          overflowY: 'auto',
          border: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--color-text-1)' }}>{title}</div>
          <button type="button" onClick={onClose} style={iconBtnStyle} title="Close">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ModalActions({ saving, onCancel, onSave }: { saving: boolean; onCancel: () => void; onSave: () => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
      <button type="button" onClick={onCancel} style={secondaryBtnStyle} disabled={saving}>Cancel</button>
      <button type="button" onClick={onSave} style={primaryBtnStyle} disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}

function BaseBadge() {
  return (
    <span style={{
      fontSize: 'var(--fs-2xs)',
      fontWeight: 700,
      letterSpacing: 0.5,
      padding: '2px 6px',
      borderRadius: 999,
      background: 'color-mix(in srgb, var(--color-cyan) 12%, transparent)',
      border: '1px solid color-mix(in srgb, var(--color-cyan) 30%, transparent)',
      color: 'rgb(3,105,161)',
    }}>BASE</span>
  )
}

// ────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────
const backLinkStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)',
  textDecoration: 'none', marginBottom: 12,
}
const headerRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  flexWrap: 'wrap', gap: 12, paddingBottom: 12, marginBottom: 14,
  borderBottom: '1px solid color-mix(in srgb, var(--color-cyan) 25%, transparent)',
}
const titleStyle: React.CSSProperties = { fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)' }
const subtitleStyle: React.CSSProperties = { fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }
const tableWrapStyle: React.CSSProperties = {
  background: 'var(--color-bg-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  overflow: 'hidden',
}
const tableHeaderStyle: React.CSSProperties = {
  display: 'flex', gap: 12,
  padding: '10px 14px',
  background: 'color-mix(in srgb, var(--color-cyan) 4%, transparent)',
  borderBottom: '1px solid var(--color-border)',
  fontSize: 'var(--fs-2xs)', fontWeight: 700, letterSpacing: 0.5,
  textTransform: 'uppercase', color: 'var(--color-text-3)',
}
const tableRowStyle: React.CSSProperties = {
  display: 'flex', gap: 12, padding: '12px 14px',
  borderBottom: '1px solid var(--color-border)',
  alignItems: 'flex-start',
}
const codeStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono, monospace)',
  fontSize: 'var(--fs-xs)',
  color: 'var(--color-text-2)',
  background: 'color-mix(in srgb, var(--color-text-1) 6%, transparent)',
  padding: '2px 6px',
  borderRadius: 4,
}
const materialLinkStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  marginTop: 6,
  fontSize: 'var(--fs-2xs)',
  color: 'var(--color-cyan)', textDecoration: 'none',
}
const iconBtnStyle: React.CSSProperties = {
  background: 'transparent', border: '1px solid var(--color-border)',
  borderRadius: 6, padding: 6,
  cursor: 'pointer', color: 'var(--color-text-2)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}
const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', borderRadius: 6,
  background: 'var(--color-cyan)', color: '#fff',
  border: 'none', fontFamily: 'inherit',
  fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer',
}
const secondaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', borderRadius: 6,
  background: 'transparent', color: 'var(--color-text-2)',
  border: '1px solid var(--color-border)', fontFamily: 'inherit',
  fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer',
}
const fieldGroupStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }
const fieldRowStyle: React.CSSProperties = { display: 'flex', gap: 12 }
const labelStyle: React.CSSProperties = {
  fontSize: 'var(--fs-xs)', fontWeight: 600,
  color: 'var(--color-text-2)',
}
const inputStyle: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 6,
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg-surface)',
  color: 'var(--color-text-1)',
  fontFamily: 'inherit', fontSize: 'var(--fs-sm)',
}
const readOnlyValueStyle: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 6,
  background: 'color-mix(in srgb, var(--color-text-1) 4%, transparent)',
  color: 'var(--color-text-2)',
  fontSize: 'var(--fs-sm)',
}
const fieldHintStyle: React.CSSProperties = {
  fontSize: 'var(--fs-2xs)', color: 'var(--color-text-4)', marginTop: 2,
}
const hintBoxStyle: React.CSSProperties = {
  display: 'flex', gap: 10,
  padding: '10px 12px', borderRadius: 6,
  background: 'color-mix(in srgb, var(--color-cyan) 6%, transparent)',
  border: '1px solid color-mix(in srgb, var(--color-cyan) 25%, transparent)',
  color: 'var(--color-text-2)', fontSize: 'var(--fs-xs)',
  alignItems: 'flex-start',
}
const emptyStateStyle: React.CSSProperties = {
  display: 'flex', gap: 10, padding: 14, borderRadius: 6,
  background: 'color-mix(in srgb, var(--color-amber) 6%, transparent)',
  border: '1px solid color-mix(in srgb, var(--color-amber) 25%, transparent)',
  color: 'var(--color-text-2)', fontSize: 'var(--fs-sm)',
  alignItems: 'center',
}
