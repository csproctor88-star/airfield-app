'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useInstallation } from '@/lib/installation-context'
import {
  fetchInspectionTemplate,
  createDefaultTemplate,
  updateTemplateItem,
  addTemplateItem,
  deleteTemplateItem,
  addTemplateSection,
  deleteTemplateSection,
  updateTemplateSection,
  reorderTemplateItems,
  reorderTemplateSections,
  type TemplateSection,
  type TemplateItem,
} from '@/lib/supabase/inspection-templates'
import { fetchLightingSystems, fetchAllComponentsForBase } from '@/lib/supabase/lighting-systems'
import { fetchLinksForTemplate, setLinksForItem, fetchTemplateId, systemIdsFromLinks, type ItemLink } from '@/lib/supabase/inspection-item-links'
import type { LightingSystem, LightingSystemComponent } from '@/lib/supabase/types'
import { Link2 } from 'lucide-react'

type TemplateType = 'airfield' | 'lighting'

export default function TemplateManagementPage() {
  const { installationId, currentInstallation, userRole } = useInstallation()
  const [activeType, setActiveType] = useState<TemplateType>('airfield')
  const [sections, setSections] = useState<TemplateSection[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

  // ── Editing state ──
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [addingSectionId, setAddingSectionId] = useState<string | null>(null)
  const [newItemText, setNewItemText] = useState('')
  const [addingSection, setAddingSection] = useState(false)
  const [newSectionTitle, setNewSectionTitle] = useState('')

  // ── System linking state (lighting templates only) ──
  const [lightingSystems, setLightingSystems] = useState<LightingSystem[]>([])
  const [systemComponents, setSystemComponents] = useState<LightingSystemComponent[]>([])
  const [itemLinks, setItemLinks] = useState<Record<string, ItemLink[]>>({})
  const [linkingItemId, setLinkingItemId] = useState<string | null>(null)
  const [linkDraft, setLinkDraft] = useState<ItemLink[]>([])

  const canEdit = userRole === 'airfield_manager' || userRole === 'sys_admin' || userRole === 'base_admin' || userRole === 'namo'

  const isInitialLoad = useRef(true)

  const loadTemplate = useCallback(async () => {
    if (!installationId) return
    const scrollY = window.scrollY
    setLoading(true)
    const data = await fetchInspectionTemplate(installationId, activeType)
    setSections(data)
    // Auto-expand all sections only on initial load
    if (isInitialLoad.current) {
      setExpandedSections(new Set(data.map(s => s.id)))
      isInitialLoad.current = false
    }
    setLoading(false)
    // Restore scroll position after re-render (prevents jump to top on edits)
    requestAnimationFrame(() => window.scrollTo(0, scrollY))
  }, [installationId, activeType])

  useEffect(() => {
    isInitialLoad.current = true
    loadTemplate()
  }, [loadTemplate])

  // Load lighting systems + item links when on lighting tab
  useEffect(() => {
    if (!installationId || activeType !== 'lighting') {
      setLightingSystems([])
      setSystemComponents([])
      setItemLinks({})
      return
    }
    async function loadLinks() {
      const [systems, components, tmplId] = await Promise.all([
        fetchLightingSystems(installationId!),
        fetchAllComponentsForBase(installationId!),
        fetchTemplateId(installationId!, 'lighting'),
      ])
      setLightingSystems(systems)
      setSystemComponents(components)
      if (tmplId) {
        const links = await fetchLinksForTemplate(tmplId)
        setItemLinks(links)
      }
    }
    loadLinks()
  }, [installationId, activeType, sections]) // re-fetch when sections change (template reload)

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Item operations ──
  const handleEditItem = (item: TemplateItem) => {
    setEditingItem(item.id)
    setEditText(item.item_text)
  }

  const handleSaveItem = async (item: TemplateItem) => {
    if (editText.trim() === item.item_text) {
      setEditingItem(null)
      return
    }
    const ok = await updateTemplateItem(item.id, { item_text: editText.trim() })
    if (ok) {
      toast.success('Item updated')
      await loadTemplate()
    } else {
      toast.error('Failed to update item')
    }
    setEditingItem(null)
  }

  const handleToggleType = async (item: TemplateItem) => {
    const cycle: Array<'pass_fail' | 'bwc' | 'rsc' | 'rcr'> = ['pass_fail', 'bwc', 'rsc', 'rcr']
    const idx = cycle.indexOf(item.item_type)
    const newType = cycle[(idx + 1) % cycle.length]
    const labelMap: Record<string, string> = { pass_fail: 'Pass/Fail', bwc: 'BWC', rsc: 'RSC', rcr: 'RCR' }
    const ok = await updateTemplateItem(item.id, { item_type: newType })
    if (ok) {
      toast.success(`Changed to ${labelMap[newType]}`)
      await loadTemplate()
    }
  }

  const handleDeleteItem = async (item: TemplateItem) => {
    if (!confirm(`Delete "${item.item_text}"?`)) return
    const ok = await deleteTemplateItem(item.id)
    if (ok) {
      toast.success('Item deleted')
      // Reload then renumber all items globally
      const data = await fetchInspectionTemplate(installationId!, activeType)
      await renumberAllItems(data)
      await loadTemplate()
    } else {
      toast.error('Failed to delete')
    }
  }

  // Renumber item_number sequentially across ALL sections (global numbering)
  const renumberAllItems = async (allSections: TemplateSection[]) => {
    let globalNum = 0
    const updates: { id: string; sort_order: number; item_number: number }[] = []
    for (const sec of allSections) {
      for (const item of sec.items) {
        globalNum++
        if (item.item_number !== globalNum) {
          updates.push({ id: item.id, sort_order: item.sort_order, item_number: globalNum })
        }
      }
    }
    if (updates.length > 0) {
      await reorderTemplateItems(updates)
    }
  }

  const handleAddItem = async (section: TemplateSection) => {
    if (!newItemText.trim()) return
    // Calculate global item number: count all items in sections before this one, plus this section's count + 1
    const sectionIndex = sections.findIndex(s => s.id === section.id)
    let globalNum = 0
    for (let i = 0; i <= sectionIndex; i++) {
      globalNum += sections[i].items.length
    }
    const maxSort = Math.max(0, ...section.items.map(i => i.sort_order))
    const result = await addTemplateItem(section.id, {
      item_key: `custom-${Date.now()}`,
      item_number: globalNum + 1,
      item_text: newItemText.trim(),
      sort_order: maxSort + 1,
    })
    if (result) {
      toast.success('Item added')
      setNewItemText('')
      setAddingSectionId(null)
      // Reload then renumber all items globally
      const data = await fetchInspectionTemplate(installationId!, activeType)
      await renumberAllItems(data)
      await loadTemplate()
    } else {
      toast.error('Failed to add item')
    }
  }

  // ── Section operations ──
  const handleAddSection = async () => {
    if (!newSectionTitle.trim() || !installationId) return
    const maxSort = Math.max(0, ...sections.map(s => s.sort_order))
    const sectionId = `custom-${Date.now()}`
    const id = await addTemplateSection(installationId, activeType, {
      section_id: sectionId,
      title: newSectionTitle.trim(),
      sort_order: maxSort + 1,
    })
    if (id) {
      toast.success('Section added')
      setNewSectionTitle('')
      setAddingSection(false)
      await loadTemplate()
    } else {
      toast.error('Failed to add section')
    }
  }

  const handleDeleteSection = async (section: TemplateSection) => {
    if (!confirm(`Delete "${section.title}" and all its items? This cannot be undone.`)) return
    const ok = await deleteTemplateSection(section.id)
    if (ok) {
      toast.success('Section deleted')
      // Reload then renumber all items globally
      const data = await fetchInspectionTemplate(installationId!, activeType)
      await renumberAllItems(data)
      await loadTemplate()
    } else {
      toast.error('Failed to delete section')
    }
  }

  const handleEditSectionTitle = async (section: TemplateSection, newTitle: string) => {
    if (newTitle.trim() === section.title) return
    const ok = await updateTemplateSection(section.id, { title: newTitle.trim() })
    if (ok) {
      toast.success('Section title updated')
      await loadTemplate()
    }
  }

  // ── System linking ──
  const handleOpenLinking = (item: TemplateItem) => {
    setLinkingItemId(item.id)
    setLinkDraft(itemLinks[item.id] || [])
  }

  const handleSaveLinks = async () => {
    if (!linkingItemId) return
    const ok = await setLinksForItem(linkingItemId, linkDraft)
    if (ok) {
      setItemLinks(prev => ({ ...prev, [linkingItemId]: linkDraft }))
      const count = linkDraft.length
      toast.success(`Linked ${count} item${count !== 1 ? 's' : ''}`)
    } else {
      toast.error('Failed to save links')
    }
    setLinkingItemId(null)
  }

  // Toggle a component within a system. If component_id is null, links the whole system.
  const handleToggleLinkComponent = (systemId: string, componentId: string | null) => {
    setLinkDraft(prev => {
      const exists = prev.some(l => l.system_id === systemId && l.component_id === componentId)
      if (exists) {
        return prev.filter(l => !(l.system_id === systemId && l.component_id === componentId))
      }
      return [...prev, { system_id: systemId, component_id: componentId }]
    })
  }

  // Check if a specific link is in the draft
  const isLinkActive = (systemId: string, componentId: string | null) => {
    return linkDraft.some(l => l.system_id === systemId && l.component_id === componentId)
  }

  // ── Reorder items within a section ──
  const handleMoveItem = async (section: TemplateSection, itemIndex: number, direction: 'up' | 'down') => {
    const items = [...section.items]
    const targetIndex = direction === 'up' ? itemIndex - 1 : itemIndex + 1
    if (targetIndex < 0 || targetIndex >= items.length) return

    // Swap
    ;[items[itemIndex], items[targetIndex]] = [items[targetIndex], items[itemIndex]]

    // Update sort_order for this section's items
    const sortUpdates = items.map((item, i) => ({
      id: item.id,
      sort_order: i,
      item_number: item.item_number, // temporary, will be renumbered below
    }))

    const ok = await reorderTemplateItems(sortUpdates)
    if (ok) {
      // Reload then renumber all items globally
      const data = await fetchInspectionTemplate(installationId!, activeType)
      await renumberAllItems(data)
      await loadTemplate()
    } else {
      toast.error('Failed to reorder')
    }
  }

  // ── Reorder sections ──
  const handleMoveSection = async (sectionIndex: number, direction: 'up' | 'down') => {
    const list = [...sections]
    const targetIndex = direction === 'up' ? sectionIndex - 1 : sectionIndex + 1
    if (targetIndex < 0 || targetIndex >= list.length) return

    // Swap
    ;[list[sectionIndex], list[targetIndex]] = [list[targetIndex], list[sectionIndex]]

    const updates = list.map((s, i) => ({ id: s.id, sort_order: i }))

    const ok = await reorderTemplateSections(updates)
    if (ok) {
      await loadTemplate()
    } else {
      toast.error('Failed to reorder')
    }
  }

  if (!canEdit) {
    return (
      <div style={{ padding: 24 }}>
        <Link href="/settings" style={{ color: 'var(--color-primary)', fontSize: 'var(--fs-md)', textDecoration: 'none' }}>
          &larr; Settings
        </Link>
        <h1 style={{ marginTop: 16, fontSize: 'var(--fs-4xl)', fontWeight: 700, color: 'var(--color-text-1)' }}>
          Inspection Templates
        </h1>
        <p style={{ color: 'var(--color-text-3)', marginTop: 8 }}>
          Only Airfield Managers and System Admins can manage templates.
        </p>
      </div>
    )
  }

  return (
    <div className="page-container" style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Header */}
      <Link href="/settings" style={{ color: 'var(--color-primary)', fontSize: 'var(--fs-md)', textDecoration: 'none' }}>
        &larr; Settings
      </Link>
      <h1 style={{ marginTop: 12, fontSize: 'var(--fs-4xl)', fontWeight: 700, color: 'var(--color-text-1)' }}>
        Inspection Templates
      </h1>
      <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-md)', marginTop: 4 }}>
        {currentInstallation?.name ?? 'Current Base'} — Customize checklist items for airfield and lighting inspections.
      </p>

      {/* Template type toggle */}
      <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
        {(['airfield', 'lighting'] as const).map(type => {
          const isActive = activeType === type
          return (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: isActive ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                cursor: 'pointer',
                fontSize: 'var(--fs-md)',
                fontWeight: 700,
                fontFamily: 'inherit',
                background: isActive ? 'rgba(56,189,248,0.12)' : 'var(--color-bg-inset)',
                color: isActive ? 'var(--color-accent)' : 'var(--color-text-2)',
                transition: 'all 0.15s',
              }}
            >
              {type === 'airfield' ? 'Airfield' : 'Lighting'}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-3)' }}>Loading template...</div>
      ) : sections.length === 0 ? (
        <EmptyTemplateState installationId={installationId} activeType={activeType} onCreated={loadTemplate} />
      ) : (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sections.map((section, sectionIndex) => (
            <div
              key={section.id}
              style={{
                background: 'var(--color-surface-1)',
                border: '1px solid var(--color-border)',
                borderRadius: 10,
                overflow: 'hidden',
              }}
            >
              {/* Section header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  cursor: 'pointer',
                  background: 'var(--color-bg-inset)',
                }}
                onClick={() => toggleSection(section.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                  <span style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)' }}>
                    {expandedSections.has(section.id) ? '▼' : '▶'}
                  </span>
                  <span style={{ fontWeight: 600, fontSize: 'var(--fs-md)', color: 'var(--color-text-1)' }}>
                    {section.title}
                  </span>
                  <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
                    ({section.items.length} items)
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleMoveSection(sectionIndex, 'up') }}
                    disabled={sectionIndex === 0}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: sectionIndex === 0 ? 'var(--color-text-4)' : 'var(--color-text-2)',
                      cursor: sectionIndex === 0 ? 'default' : 'pointer',
                      fontSize: 'var(--fs-2xl)',
                      padding: '2px 6px',
                      minWidth: 32,
                      minHeight: 32,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Move section up"
                  >
                    &#9650;
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleMoveSection(sectionIndex, 'down') }}
                    disabled={sectionIndex === sections.length - 1}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: sectionIndex === sections.length - 1 ? 'var(--color-text-4)' : 'var(--color-text-2)',
                      cursor: sectionIndex === sections.length - 1 ? 'default' : 'pointer',
                      fontSize: 'var(--fs-2xl)',
                      padding: '2px 6px',
                      minWidth: 32,
                      minHeight: 32,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Move section down"
                  >
                    &#9660;
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteSection(section) }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-danger)',
                      cursor: 'pointer',
                      fontSize: 'var(--fs-base)',
                      padding: '2px 8px',
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Section guidance */}
              {expandedSections.has(section.id) && section.guidance && (
                <div style={{ padding: '6px 14px', fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', borderBottom: '1px solid var(--color-border)' }}>
                  {section.guidance}
                </div>
              )}

              {/* Items */}
              {expandedSections.has(section.id) && (
                <div style={{ padding: '8px 14px' }}>
                  {section.items.map((item, itemIndex) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 0',
                        borderBottom: '1px solid var(--color-border)',
                        fontSize: 'var(--fs-md)',
                      }}
                    >
                      {/* Reorder arrows */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, flexShrink: 0 }}>
                        <button
                          onClick={() => handleMoveItem(section, itemIndex, 'up')}
                          disabled={itemIndex === 0}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: itemIndex === 0 ? 'var(--color-text-4)' : 'var(--color-text-2)',
                            cursor: itemIndex === 0 ? 'default' : 'pointer',
                            fontSize: 'var(--fs-xs)',
                            padding: 0,
                            lineHeight: 1,
                            minWidth: 24,
                            minHeight: 22,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          title="Move up"
                        >
                          &#9650;
                        </button>
                        <button
                          onClick={() => handleMoveItem(section, itemIndex, 'down')}
                          disabled={itemIndex === section.items.length - 1}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: itemIndex === section.items.length - 1 ? 'var(--color-text-4)' : 'var(--color-text-2)',
                            cursor: itemIndex === section.items.length - 1 ? 'default' : 'pointer',
                            fontSize: 'var(--fs-xs)',
                            padding: 0,
                            lineHeight: 1,
                            minWidth: 24,
                            minHeight: 22,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          title="Move down"
                        >
                          &#9660;
                        </button>
                      </div>

                      <span style={{ width: 28, textAlign: 'right', color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', flexShrink: 0 }}>
                        {item.item_number}.
                      </span>

                      {editingItem === item.id ? (
                        <input
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          onBlur={() => handleSaveItem(item)}
                          onKeyDown={e => e.key === 'Enter' && handleSaveItem(item)}
                          autoFocus
                          style={{
                            flex: 1,
                            padding: '4px 8px',
                            borderRadius: 4,
                            border: '1px solid var(--color-primary)',
                            background: 'var(--color-bg-inset)',
                            color: 'var(--color-text-1)',
                            fontSize: 'var(--fs-md)',
                          }}
                        />
                      ) : (
                        <span
                          style={{ flex: 1, color: 'var(--color-text-1)', cursor: 'pointer' }}
                          onClick={() => handleEditItem(item)}
                          title="Click to edit"
                        >
                          {item.item_text}
                        </span>
                      )}

                      <button
                        onClick={() => handleToggleType(item)}
                        style={{
                          fontSize: 'var(--fs-xs)',
                          padding: '2px 6px',
                          borderRadius: 4,
                          border: '1px solid var(--color-border)',
                          background: item.item_type === 'bwc' ? 'var(--color-warning)' : item.item_type === 'rsc' ? '#3B82F620' : item.item_type === 'rcr' ? '#8B5CF620' : 'var(--color-bg-inset)',
                          color: item.item_type === 'bwc' ? '#000' : item.item_type === 'rsc' ? '#3B82F6' : item.item_type === 'rcr' ? '#8B5CF6' : 'var(--color-text-2)',
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                        title={`${({ pass_fail: 'Pass/Fail', bwc: 'BWC', rsc: 'RSC', rcr: 'RCR' } as Record<string, string>)[item.item_type] || 'Pass/Fail'} — click to cycle type`}
                      >
                        {({ pass_fail: 'P/F', bwc: 'BWC', rsc: 'RSC', rcr: 'RCR' } as Record<string, string>)[item.item_type] || 'P/F'}
                      </button>

                      {/* System link button — lighting templates, pass_fail items only */}
                      {activeType === 'lighting' && item.item_type === 'pass_fail' && lightingSystems.length > 0 && (() => {
                        const linkCount = itemLinks[item.id]?.length ?? 0
                        return (
                          <button
                            onClick={() => handleOpenLinking(item)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 3,
                              fontSize: 'var(--fs-xs)',
                              padding: '2px 6px',
                              borderRadius: 4,
                              border: '1px solid',
                              borderColor: linkCount > 0 ? '#22D3EE' : 'var(--color-border)',
                              background: linkCount > 0 ? 'rgba(34,211,238,0.12)' : 'var(--color-bg-inset)',
                              color: linkCount > 0 ? '#22D3EE' : 'var(--color-text-3)',
                              cursor: 'pointer',
                              flexShrink: 0,
                            }}
                            title="Link to lighting systems / components"
                          >
                            <Link2 size={11} />
                            {linkCount > 0 ? `${linkCount}` : ''}
                          </button>
                        )
                      })()}

                      <button
                        onClick={() => handleDeleteItem(item)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-danger)',
                          cursor: 'pointer',
                          fontSize: 'var(--fs-lg)',
                          flexShrink: 0,
                          padding: '0 4px',
                        }}
                        title="Delete item"
                      >
                        &times;
                      </button>
                    </div>
                  ))}

                  {/* Add item */}
                  {addingSectionId === section.id ? (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <input
                        value={newItemText}
                        onChange={e => setNewItemText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddItem(section)}
                        placeholder="New item text..."
                        autoFocus
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-bg-inset)',
                          color: 'var(--color-text-1)',
                          fontSize: 'var(--fs-md)',
                        }}
                      />
                      <button
                        onClick={() => handleAddItem(section)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          border: 'none',
                          background: 'var(--color-primary)',
                          color: '#fff',
                          cursor: 'pointer',
                          fontSize: 'var(--fs-base)',
                          fontWeight: 600,
                        }}
                      >
                        Add
                      </button>
                      <button
                        onClick={() => { setAddingSectionId(null); setNewItemText('') }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-bg-inset)',
                          color: 'var(--color-text-2)',
                          cursor: 'pointer',
                          fontSize: 'var(--fs-base)',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingSectionId(section.id)}
                      style={{
                        marginTop: 8,
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: '1px dashed var(--color-border)',
                        background: 'none',
                        color: 'var(--color-primary)',
                        cursor: 'pointer',
                        fontSize: 'var(--fs-base)',
                        width: '100%',
                      }}
                    >
                      + Add Item
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Add section */}
          {addingSection ? (
            <div style={{
              display: 'flex', gap: 8, padding: 14,
              background: 'var(--color-surface-1)',
              border: '1px solid var(--color-border)',
              borderRadius: 10,
            }}>
              <input
                value={newSectionTitle}
                onChange={e => setNewSectionTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddSection()}
                placeholder="New section title..."
                autoFocus
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg-inset)',
                  color: 'var(--color-text-1)',
                  fontSize: 'var(--fs-md)',
                }}
              />
              <button
                onClick={handleAddSection}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'var(--color-primary)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 'var(--fs-base)',
                  fontWeight: 600,
                }}
              >
                Add Section
              </button>
              <button
                onClick={() => { setAddingSection(false); setNewSectionTitle('') }}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg-inset)',
                  color: 'var(--color-text-2)',
                  cursor: 'pointer',
                  fontSize: 'var(--fs-base)',
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddingSection(true)}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px dashed var(--color-border)',
                background: 'none',
                color: 'var(--color-primary)',
                cursor: 'pointer',
                fontSize: 'var(--fs-md)',
                fontWeight: 600,
              }}
            >
              + Add Section
            </button>
          )}
        </div>
      )}

      {/* ── System / Component Linking Modal ── */}
      {linkingItemId && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.7)', padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setLinkingItemId(null) }}
        >
          <div style={{
            background: 'var(--color-bg-elevated)',
            borderRadius: 12,
            border: '1px solid var(--color-border)',
            padding: 20,
            maxWidth: 480,
            width: '100%',
            maxHeight: '80vh',
            overflow: 'auto',
          }}>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 4 }}>
              Link Systems &amp; Components
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 12 }}>
              Select entire systems or individual components. When this item fails, the inspector will pick features from the linked items.
            </div>

            {lightingSystems.length === 0 ? (
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', padding: 16, textAlign: 'center' }}>
                No lighting systems configured. Set them up in Visual NAVAIDs first.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {lightingSystems.map(sys => {
                  const sysComponents = systemComponents.filter(c => c.system_id === sys.id)
                  const wholeSystemLinked = isLinkActive(sys.id, null)
                  const hasAnyComponentLink = sysComponents.some(c => isLinkActive(sys.id, c.id))

                  return (
                    <div key={sys.id} style={{
                      border: '1px solid var(--color-border)',
                      borderRadius: 8,
                      overflow: 'hidden',
                    }}>
                      {/* System header — links whole system */}
                      <button
                        type="button"
                        onClick={() => handleToggleLinkComponent(sys.id, null)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 10px', cursor: 'pointer', width: '100%',
                          border: 'none',
                          background: wholeSystemLinked ? 'rgba(34,211,238,0.10)' : 'var(--color-bg-inset)',
                          color: 'var(--color-text-1)',
                          fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{
                          width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                          border: wholeSystemLinked ? '2px solid #22D3EE' : '2px solid var(--color-text-3)',
                          background: wholeSystemLinked ? '#22D3EE' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 800, color: '#000',
                        }}>
                          {wholeSystemLinked ? '\u2713' : ''}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600 }}>{sys.name}</div>
                          {sys.runway_or_taxiway && (
                            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
                              {sys.runway_or_taxiway}
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
                          All features
                        </span>
                      </button>

                      {/* Components within this system */}
                      {sysComponents.length > 0 && (
                        <div style={{
                          borderTop: '1px solid var(--color-border)',
                          padding: '4px 0',
                        }}>
                          {sysComponents.map(comp => {
                            const compLinked = isLinkActive(sys.id, comp.id)
                            return (
                              <button
                                key={comp.id}
                                type="button"
                                onClick={() => handleToggleLinkComponent(sys.id, comp.id)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 8,
                                  padding: '6px 10px 6px 32px', cursor: 'pointer', width: '100%',
                                  border: 'none',
                                  background: compLinked ? 'rgba(34,211,238,0.06)' : 'transparent',
                                  color: 'var(--color-text-1)',
                                  fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
                                  textAlign: 'left',
                                }}
                              >
                                <span style={{
                                  width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                                  border: compLinked ? '2px solid #22D3EE' : '1.5px solid var(--color-text-4)',
                                  background: compLinked ? '#22D3EE' : 'transparent',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 10, fontWeight: 800, color: '#000',
                                }}>
                                  {compLinked ? '\u2713' : ''}
                                </span>
                                <span style={{ flex: 1 }}>{comp.label}</span>
                                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-4)' }}>
                                  {comp.total_count} features
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button
                onClick={handleSaveLinks}
                style={{
                  flex: 1, padding: '10px', borderRadius: 8, border: 'none',
                  background: 'var(--color-primary)', color: '#fff',
                  fontSize: 'var(--fs-base)', fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Save ({linkDraft.length} link{linkDraft.length !== 1 ? 's' : ''})
              </button>
              <button
                onClick={() => setLinkingItemId(null)}
                style={{
                  padding: '10px 16px', borderRadius: 8,
                  border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)',
                  color: 'var(--color-text-2)', fontSize: 'var(--fs-base)',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Empty Template State — offers to initialize from default
// ═══════════════════════════════════════════════════════════════

function EmptyTemplateState({
  installationId,
  activeType,
  onCreated,
}: {
  installationId: string | null
  activeType: 'airfield' | 'lighting'
  onCreated: () => void
}) {
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!installationId) return
    setCreating(true)
    const ok = await createDefaultTemplate(installationId, activeType)
    if (ok) {
      toast.success(`${activeType === 'airfield' ? 'Airfield' : 'Lighting'} template created from default`)
      onCreated()
    } else {
      toast.error('Failed to create template — does a source template exist?')
    }
    setCreating(false)
  }

  return (
    <div style={{
      textAlign: 'center',
      padding: 40,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 16,
    }}>
      <div style={{ fontSize: 32 }}>
        {activeType === 'airfield' ? '📋' : '💡'}
      </div>
      <div>
        <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 4 }}>
          No {activeType} template configured
        </div>
        <div style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-3)' }}>
          Initialize from the default template to get started, then customize as needed.
        </div>
      </div>
      <button
        onClick={handleCreate}
        disabled={creating}
        style={{
          padding: '10px 20px',
          borderRadius: 8,
          border: 'none',
          background: 'linear-gradient(135deg, #0369A1, var(--color-accent-secondary))',
          color: '#fff',
          fontSize: 'var(--fs-lg)',
          fontWeight: 700,
          cursor: creating ? 'wait' : 'pointer',
          fontFamily: 'inherit',
          opacity: creating ? 0.5 : 1,
        }}
      >
        {creating ? 'Creating...' : 'Initialize from Default Template'}
      </button>
    </div>
  )
}
