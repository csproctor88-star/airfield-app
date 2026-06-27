# Customizable Dashboard — Phase 2 (Embeds, Links, Shared Boards, Role Templates) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add user-configurable widgets (links + web embeds), multiple boards with a switcher, base-shared boards, and admin-set role-default templates new users inherit.

**Architecture:** Builds on Phase 1. Introduces a per-widget config-editing flow (a `ConfigForm` slot on `WidgetDef` + a gear affordance in `WidgetFrame` + a config modal in the host). Adds `links`/`embed` widget kinds. Extends the board CRUD + `BoardBar` into a real multi-board switcher gated by the `dashboard:publish-shared` / `dashboard:manage-templates` permissions seeded in Phase 1. Role templates are shared boards tagged with `role_template`; a new user's first board clones the template matching their `profiles.role`.

**Tech Stack:** Next.js 14, TypeScript strict, Supabase + RLS, react-grid-layout, vitest.

**Spec:** `docs/superpowers/specs/2026-06-27-customizable-dashboard-design.md`
**Phase 1 plan (done):** `docs/superpowers/plans/2026-06-27-customizable-dashboard-phase1.md`

**Conventions (carried from Phase 1):** offline-queue all writes; theme tokens only; gate commits on `npm run build` RC 0 AND `npx vitest run`; matrix RLS helpers only; co-author trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. No DB migration is needed — Phase 1 already created `scope`, `role_template`, and the permission keys.

---

## File structure

**Create:**
- `lib/dashboard/widget-config.ts` — pure `updateWidgetConfig` helper (+ test)
- `components/dashboard/widget-config-modal.tsx` — generic host that renders a widget's `ConfigForm`
- `components/dashboard/widgets/links-widget.tsx` — `LinksWidget` + `LinksConfigForm`
- `components/dashboard/widgets/embed-widget.tsx` — `EmbedWidget` + `EmbedConfigForm`
- `lib/dashboard/board-templates.ts` — `currentUserRole` + `seedLayoutFromTemplate` (+ test for the pure part)
- `tests/dashboard-widget-config.test.ts`, `tests/dashboard-board-templates.test.ts`

**Modify:**
- `lib/dashboard/widget-registry.ts` — add optional `ConfigForm` to `WidgetDef` + `WidgetConfigProps`
- `lib/dashboard/registry.tsx` — register `links` + `embed`; attach config forms
- `lib/supabase/dashboard-boards.ts` — add `updateBoard` (name/scope/role_template), broaden `createBoard`
- `components/dashboard/widget-frame.tsx` — gear (configure) button in edit mode when a ConfigForm exists
- `components/dashboard/widget-grid.tsx` — surface an `onConfigure(id)` callback
- `components/dashboard/board-bar.tsx` — replace static title with a board switcher + new/rename/delete + share controls
- `app/(app)/dashboard/page.tsx` — multi-board state, active board, config modal wiring, template seeding
- `next.config.js` — add `frame-src` to the report-only CSP

---

## Task 1: Widget config infrastructure (pure helper + registry types)

**Files:**
- Create: `lib/dashboard/widget-config.ts`, `tests/dashboard-widget-config.test.ts`
- Modify: `lib/dashboard/widget-registry.ts`

- [ ] **Step 1: Failing test** `tests/dashboard-widget-config.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { updateWidgetConfig } from '@/lib/dashboard/widget-config'
import type { WidgetInstance } from '@/lib/dashboard/layout'

const base: WidgetInstance[] = [
  { i: 'a', type: 'links', config: { title: 'Old' }, x: 0, y: 0, w: 3, h: 2 },
  { i: 'b', type: 'embed', config: {}, x: 0, y: 2, w: 3, h: 2 },
]

describe('updateWidgetConfig', () => {
  it('replaces the config of the matching widget only', () => {
    const out = updateWidgetConfig(base, 'a', { title: 'New', links: [] })
    expect(out.find(w => w.i === 'a')!.config).toEqual({ title: 'New', links: [] })
    expect(out.find(w => w.i === 'b')!.config).toEqual({})
  })
  it('returns a new array and does not mutate the input', () => {
    const out = updateWidgetConfig(base, 'a', { title: 'X' })
    expect(out).not.toBe(base)
    expect(base.find(w => w.i === 'a')!.config).toEqual({ title: 'Old' })
  })
  it('is a no-op (new array) when the id is not found', () => {
    const out = updateWidgetConfig(base, 'zzz', { title: 'X' })
    expect(out.map(w => w.config)).toEqual(base.map(w => w.config))
  })
})
```

Run `npx vitest run tests/dashboard-widget-config.test.ts` → FAIL.

- [ ] **Step 2: Implement** `lib/dashboard/widget-config.ts`

```ts
import type { WidgetInstance } from '@/lib/dashboard/layout'

/** Return a new layout with the matching widget's config replaced. Pure. */
export function updateWidgetConfig(
  widgets: WidgetInstance[],
  id: string,
  config: Record<string, unknown>,
): WidgetInstance[] {
  return widgets.map(w => (w.i === id ? { ...w, config } : w))
}
```

- [ ] **Step 3: Extend registry types** in `lib/dashboard/widget-registry.ts`

Add a config-form props type and an optional `ConfigForm` to `WidgetDef`:

```ts
export interface WidgetConfigProps {
  config: Record<string, unknown>
  onSave: (config: Record<string, unknown>) => void
  onCancel: () => void
}
```

In `WidgetDef`, add:
```ts
  ConfigForm?: ComponentType<WidgetConfigProps>
```

- [ ] **Step 4:** `npx vitest run tests/dashboard-widget-config.test.ts` → PASS (3). `npx tsc --noEmit` → 0.

- [ ] **Step 5: Commit**
```
git add lib/dashboard/widget-config.ts tests/dashboard-widget-config.test.ts lib/dashboard/widget-registry.ts
git commit -m "feat(dashboard): widget config helper + ConfigForm slot"
```

---

## Task 2: Config affordance in frame + grid + modal host

**Files:**
- Modify: `components/dashboard/widget-frame.tsx`, `components/dashboard/widget-grid.tsx`
- Create: `components/dashboard/widget-config-modal.tsx`

- [ ] **Step 1: WidgetFrame — add a configure (gear) button**

Add an optional `onConfigure?: () => void` prop. In the header, BEFORE the remove button, when `editing && onConfigure`, render a gear button (lucide `Settings2`, size 14, theme tokens, `aria-label={`Configure ${title}`}`) that calls `onConfigure`. Keep the existing remove button.

- [ ] **Step 2: WidgetGrid — thread `onConfigure`**

Add prop `onConfigure: (id: string) => void`. Pass `onConfigure={() => onConfigure(w.i)}` into each `WidgetFrame` ONLY when that widget's `getWidgetDef(w.type)?.ConfigForm` is defined (so widgets without config show no gear). Leave everything else unchanged.

- [ ] **Step 3: Config modal host** `components/dashboard/widget-config-modal.tsx`

```tsx
'use client'
import type { WidgetInstance } from '@/lib/dashboard/layout'
import { getWidgetDef } from '@/lib/dashboard/registry'

export function WidgetConfigModal({
  widget, onSave, onClose,
}: {
  widget: WidgetInstance
  onSave: (config: Record<string, unknown>) => void
  onClose: () => void
}) {
  const def = getWidgetDef(widget.type)
  if (!def?.ConfigForm) return null
  const Form = def.ConfigForm
  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card" style={{ width: '100%', maxWidth: 480, padding: 20, maxHeight: '85vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 12 }}>
          Configure {def.title}
        </div>
        <Form config={widget.config} onSave={(c) => { onSave(c); onClose() }} onCancel={onClose} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4:** `npx tsc --noEmit` → 0. (Host wiring is Task 6; this compiles standalone because props are passed by callers later.)

- [ ] **Step 5: Commit**
```
git add components/dashboard/widget-frame.tsx components/dashboard/widget-grid.tsx components/dashboard/widget-config-modal.tsx
git commit -m "feat(dashboard): per-widget configure affordance + config modal host"
```

---

## Task 3: Links widget

**Files:**
- Create: `components/dashboard/widgets/links-widget.tsx`
- Modify: `lib/dashboard/registry.tsx`

- [ ] **Step 1: Implement** `components/dashboard/widgets/links-widget.tsx`

Two exports: `LinksWidget` (display) and `LinksConfigForm` (editor).

```tsx
'use client'
import { useState } from 'react'
import { ExternalLink, Plus, Trash2 } from 'lucide-react'
import type { WidgetConfigProps } from '@/lib/dashboard/widget-registry'

type LinkRow = { label: string; url: string }
type LinksConfig = { title?: string; links?: LinkRow[] }

function normUrl(u: string): string {
  const t = u.trim()
  if (!t) return ''
  return /^https?:\/\//i.test(t) ? t : `https://${t}`
}

export function LinksWidget({ config }: { config: Record<string, unknown> }) {
  const c = config as LinksConfig
  const links = Array.isArray(c.links) ? c.links : []
  if (links.length === 0) {
    return <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>No links yet. Edit this widget to add some.</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {links.map((l, i) => (
        <a key={i} href={normUrl(l.url)} target="_blank" rel="noopener noreferrer" style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0',
          textDecoration: 'none', color: 'var(--color-accent)', fontSize: 'var(--fs-sm)', fontWeight: 600,
        }}>
          <ExternalLink size={14} strokeWidth={2.25} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.label || l.url}</span>
        </a>
      ))}
    </div>
  )
}

export function LinksConfigForm({ config, onSave, onCancel }: WidgetConfigProps) {
  const c = config as LinksConfig
  const [title, setTitle] = useState(c.title ?? '')
  const [rows, setRows] = useState<LinkRow[]>(Array.isArray(c.links) && c.links.length ? c.links : [{ label: '', url: '' }])

  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
    color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
  }
  const setRow = (i: number, patch: Partial<LinkRow>) => setRows(rs => rs.map((r, j) => j === i ? { ...r, ...patch } : r))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input style={input} placeholder="Widget title (optional)" value={title} onChange={e => setTitle(e.target.value)} />
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input style={{ ...input, flex: '0 0 35%' }} placeholder="Label" value={r.label} onChange={e => setRow(i, { label: e.target.value })} />
          <input style={{ ...input, flex: 1 }} placeholder="https://…" value={r.url} onChange={e => setRow(i, { url: e.target.value })} />
          <button onClick={() => setRows(rs => rs.filter((_, j) => j !== i))} aria-label="Remove link" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-3)' }}>
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <button onClick={() => setRows(rs => [...rs, { label: '', url: '' }])} style={{
        display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', padding: '6px 10px',
        borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
        color: 'var(--color-text-2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)',
      }}><Plus size={14} /> Add link</button>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button onClick={() => onSave({ title: title.trim() || undefined, links: rows.filter(r => r.url.trim()).map(r => ({ label: r.label.trim(), url: r.url.trim() })) })} style={{
          flex: 1, padding: '9px 0', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
          background: 'var(--color-accent)', color: 'var(--color-bg-base)', fontWeight: 700, fontFamily: 'inherit',
        }}>Save</button>
        <button onClick={onCancel} style={{
          flex: 1, padding: '9px 0', borderRadius: 'var(--radius-md)', cursor: 'pointer',
          border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-2)', fontFamily: 'inherit',
        }}>Cancel</button>
      </div>
    </div>
  )
}
```

NOTE: confirm the accent-on-button text token used elsewhere (`var(--color-bg-base)` vs another) — match how primary buttons elsewhere color their text; if unsure use `#fff` only if other primary buttons do, else the project's on-accent token.

- [ ] **Step 2: Register** in `lib/dashboard/registry.tsx`

Import `Link2` from lucide, import `LinksWidget, LinksConfigForm`. Add entry:
```tsx
  'links': { type: 'links', kind: 'links', title: 'Links', description: 'A list of bookmarks that open in a new tab', icon: Link2, defaultSize: { w: 3, h: 3 }, minSize: { w: 2, h: 2 }, Component: (p) => <LinksWidget config={p.config} />, ConfigForm: LinksConfigForm },
```

- [ ] **Step 3:** `npx tsc --noEmit` → 0; `npm run build` → compiled.

- [ ] **Step 4: Commit**
```
git add components/dashboard/widgets/links-widget.tsx lib/dashboard/registry.tsx
git commit -m "feat(dashboard): links widget (open-in-new-tab bookmarks)"
```

---

## Task 4: Embed widget + CSP frame-src

**Files:**
- Create: `components/dashboard/widgets/embed-widget.tsx`
- Modify: `lib/dashboard/registry.tsx`, `next.config.js`

- [ ] **Step 1: Implement** `components/dashboard/widgets/embed-widget.tsx`

`EmbedWidget`: sandboxed iframe with a load-timeout fallback (X-Frame-Options/frame-ancestors refusals do not reliably fire `onError`, so use a timer: if `onLoad` hasn't fired within 4s, assume refusal and show the fallback card with an "Open in new tab" button). `EmbedConfigForm`: title + url.

```tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import type { WidgetConfigProps } from '@/lib/dashboard/widget-registry'

type EmbedConfig = { title?: string; url?: string }
function normUrl(u: string): string {
  const t = (u || '').trim()
  if (!t) return ''
  return /^https?:\/\//i.test(t) ? t : `https://${t}`
}

export function EmbedWidget({ config }: { config: Record<string, unknown> }) {
  const c = config as EmbedConfig
  const url = normUrl(c.url ?? '')
  const [loaded, setLoaded] = useState(false)
  const [refused, setRefused] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setLoaded(false); setRefused(false)
    if (!url) return
    timer.current = setTimeout(() => { setRefused(true) }, 4000)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [url])

  if (!url) {
    return <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>No URL set. Edit this widget to add a website.</div>
  }
  if (refused && !loaded) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>This site can&rsquo;t be embedded.</div>
        <a href={url} target="_blank" rel="noopener noreferrer" style={{
          display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-accent)', fontWeight: 600,
          fontSize: 'var(--fs-sm)', textDecoration: 'none',
        }}><ExternalLink size={14} /> Open in new tab</a>
      </div>
    )
  }
  return (
    <iframe
      src={url}
      title={c.title || 'Embedded site'}
      onLoad={() => { setLoaded(true); if (timer.current) clearTimeout(timer.current) }}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      style={{ width: '100%', height: '100%', border: 'none', borderRadius: 'var(--radius-sm)' }}
    />
  )
}

export function EmbedConfigForm({ config, onSave, onCancel }: WidgetConfigProps) {
  const c = config as EmbedConfig
  const [title, setTitle] = useState(c.title ?? '')
  const [url, setUrl] = useState(c.url ?? '')
  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
    color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input style={input} placeholder="Title (optional)" value={title} onChange={e => setTitle(e.target.value)} />
      <input style={input} placeholder="https://… (some sites block embedding)" value={url} onChange={e => setUrl(e.target.value)} />
      <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)' }}>
        Tip: many .mil / external sites refuse to be embedded. If this site shows a blank box, use a Links widget instead.
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button onClick={() => onSave({ title: title.trim() || undefined, url: url.trim() })} style={{
          flex: 1, padding: '9px 0', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
          background: 'var(--color-accent)', color: 'var(--color-bg-base)', fontWeight: 700, fontFamily: 'inherit',
        }}>Save</button>
        <button onClick={onCancel} style={{
          flex: 1, padding: '9px 0', borderRadius: 'var(--radius-md)', cursor: 'pointer',
          border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-2)', fontFamily: 'inherit',
        }}>Cancel</button>
      </div>
    </div>
  )
}
```
(Match the primary-button text token as in Task 3.)

- [ ] **Step 2: Register** in `lib/dashboard/registry.tsx` — import `Globe` (lucide) + the two exports:
```tsx
  'embed': { type: 'embed', kind: 'embed', title: 'Web Embed', description: 'Embed an external website', icon: Globe, defaultSize: { w: 4, h: 4 }, minSize: { w: 2, h: 3 }, Component: (p) => <EmbedWidget config={p.config} />, ConfigForm: EmbedConfigForm },
```

- [ ] **Step 3: CSP frame-src** in `next.config.js`

In the `Content-Security-Policy-Report-Only` value array, add a `frame-src` directive allowing self + https so embeds aren't reported (and are allowed once CSP is later promoted to enforcing):
```js
              "frame-src 'self' https:",
```
Insert it after the `worker-src` line. Leave `frame-ancestors 'none'` and `X-Frame-Options: DENY` UNCHANGED (those govern others embedding us, not us embedding others).

- [ ] **Step 4:** `npx tsc --noEmit` → 0; `npm run build` → compiled.

- [ ] **Step 5: Commit**
```
git add components/dashboard/widgets/embed-widget.tsx lib/dashboard/registry.tsx next.config.js
git commit -m "feat(dashboard): web-embed widget + CSP frame-src for embeds"
```

---

## Task 5: Board CRUD extensions + role helper

**Files:**
- Modify: `lib/supabase/dashboard-boards.ts`
- Create: `lib/dashboard/board-templates.ts`, `tests/dashboard-board-templates.test.ts`

- [ ] **Step 1: Add `updateBoard`** to `lib/supabase/dashboard-boards.ts`

```ts
export async function updateBoard(
  id: string,
  patch: Partial<Pick<DashboardBoardRow, 'name' | 'scope' | 'role_template'>>,
): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Offline' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { error } = await sb
    .from('dashboard_boards')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  return { error: error ? friendlyError(error) : null }
}
```
(Match the existing `as any` cast pattern already in this file.)

- [ ] **Step 2: Role helper + template seeding** `lib/dashboard/board-templates.ts`

```ts
import { createClient } from '@/lib/supabase/client'
import type { DashboardBoardRow } from '@/lib/supabase/dashboard-boards'
import type { WidgetInstance } from '@/lib/dashboard/layout'

/** The caller's role from profiles (authoritative; base_members.role is stale). */
export async function currentUserRole(userId: string): Promise<string | null> {
  const supabase = createClient()
  if (!supabase) return null
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).single()
  return (data as { role: string | null } | null)?.role ?? null
}

/**
 * Pick the starter layout for a new user's first board: the shared board whose
 * role_template matches the user's role, else []. Pure given the inputs.
 */
export function seedLayoutFromTemplate(
  boards: Pick<DashboardBoardRow, 'owner_id' | 'role_template' | 'layout'>[],
  role: string | null,
): WidgetInstance[] {
  if (!role) return []
  const tpl = boards.find(b => b.owner_id === null && b.role_template === role)
  return tpl ? tpl.layout : []
}
```

- [ ] **Step 3: Test** `tests/dashboard-board-templates.test.ts` (the pure function only)

```ts
import { describe, it, expect } from 'vitest'
import { seedLayoutFromTemplate } from '@/lib/dashboard/board-templates'
import type { WidgetInstance } from '@/lib/dashboard/layout'

const L: WidgetInstance[] = [{ i: 'a', type: 'last-check', config: {}, x: 0, y: 0, w: 3, h: 1 }]

describe('seedLayoutFromTemplate', () => {
  it('returns the template layout for a matching role', () => {
    const boards = [{ owner_id: null, role_template: 'namo', layout: L }]
    expect(seedLayoutFromTemplate(boards, 'namo')).toBe(L)
  })
  it('returns [] when no template matches the role', () => {
    const boards = [{ owner_id: null, role_template: 'namo', layout: L }]
    expect(seedLayoutFromTemplate(boards, 'amops')).toEqual([])
  })
  it('ignores personal boards (owner_id not null) even if role_template set', () => {
    const boards = [{ owner_id: 'u1', role_template: 'namo', layout: L }]
    expect(seedLayoutFromTemplate(boards, 'namo')).toEqual([])
  })
  it('returns [] for a null role', () => {
    expect(seedLayoutFromTemplate([{ owner_id: null, role_template: 'namo', layout: L }], null)).toEqual([])
  })
})
```

- [ ] **Step 4: Update `getOrCreateDefaultBoard`** in `lib/supabase/dashboard-boards.ts` to seed from a template:

Replace the body so that when creating the first board it seeds the layout from a matching role template:
```ts
export async function getOrCreateDefaultBoard(
  baseId: string,
  userId: string,
): Promise<DashboardBoardRow | null> {
  const boards = await fetchBoards(baseId)
  const mine = boards.find(b => b.owner_id === userId && b.is_default)
  if (mine) return mine
  const { currentUserRole, seedLayoutFromTemplate } = await import('@/lib/dashboard/board-templates')
  const role = await currentUserRole(userId)
  const seeded = seedLayoutFromTemplate(boards, role)
  const { data } = await createBoard({
    base_id: baseId, owner_id: userId, name: 'My Dashboard', is_default: true, layout: seeded,
  })
  return data
}
```

- [ ] **Step 5:** `npx vitest run tests/dashboard-board-templates.test.ts` → PASS (4); `npx tsc --noEmit` → 0.

- [ ] **Step 6: Commit**
```
git add lib/supabase/dashboard-boards.ts lib/dashboard/board-templates.ts tests/dashboard-board-templates.test.ts
git commit -m "feat(dashboard): board update + role-template seeding for new boards"
```

---

## Task 6: Board switcher + shared boards + template admin (BoardBar + host)

**Files:**
- Modify: `components/dashboard/board-bar.tsx`, `app/(app)/dashboard/page.tsx`

This is the largest task. It turns the single-board host into a multi-board experience.

- [ ] **Step 1: Rewrite `components/dashboard/board-bar.tsx`** to a switcher.

Props:
```tsx
export interface BoardBarProps {
  boards: { id: string; name: string; scope: 'personal' | 'shared'; role_template: string | null }[]
  activeId: string | null
  onSwitch: (id: string) => void
  editing: boolean
  onToggleEdit: () => void
  onAddWidget: () => void
  onNewBoard: () => void
  onRenameBoard: () => void
  onDeleteBoard: () => void
  onShareControls?: () => void   // present only if the user can publish shared boards
}
```
Render: a `<select>` (styled, theme tokens — note feedback: avoid `input-dark` full-width stretch on inline controls; style inline) listing personal boards then shared boards (group labels via `<optgroup label="Personal">` / `<optgroup label="Shared">`); a "＋ New board" action; in edit mode show Add Widget + Rename + Delete; show Share controls button only when `onShareControls` is provided. Keep the Edit/Done toggle. Use the HHMM-free, theme-token styling. Keep it compact (one row, wrap on small screens).

- [ ] **Step 2: Rewrite the host** `app/(app)/dashboard/page.tsx` to manage multiple boards.

Required behavior (write the full component; key points):
- Load ALL boards via `fetchBoards(installationId)` (not just the default). Ensure the user's default personal board exists via `getOrCreateDefaultBoard`. Track `activeId` (default to the user's default board). `widgets` mirrors the active board's layout.
- Switching boards loads that board's layout into `widgets` and resets `editing` to false.
- `persist` saves to the ACTIVE board id via `saveBoardLayout` (offline queue), running `validateLayout(next)` first (as in Phase 1).
- Permissions: read `usePermissions()`. `canPublishShared = has(PERM.DASHBOARD_PUBLISH_SHARED)`. `canManageTemplates = has(PERM.DASHBOARD_MANAGE_TEMPLATES)`.
- `onNewBoard`: prompt for a name (a small inline modal or `window.prompt` is acceptable for v1 — prefer a tiny modal consistent with the app; if using a modal, keep it minimal), `createBoard({ base_id, owner_id: userId, name, scope: 'personal' })`, refetch, switch to it.
- `onRenameBoard` / `onDeleteBoard`: operate on the active board (guard: never delete the last default personal board — if active is the default personal board, disable delete). Use `updateBoard` / `deleteBoard`, refetch.
- Shared boards: a "Share controls" affordance (only if `canPublishShared`) that lets the user (a) create a shared board (`createBoard({ owner_id: null, scope: 'shared', name })`) and (b) when the active board is shared and `canManageTemplates`, set its `role_template` (a `<select>` of role keys from `USER_ROLES` in `lib/constants`, or "none") via `updateBoard`. Writing a shared board requires the permission — RLS enforces it; surface `error` from the CRUD calls via `toast`.
- Config modal: track `configuringId`; render `<WidgetConfigModal widget={activeWidget} onSave={(c) => { const next = updateWidgetConfig(widgets, id, c); setWidgets(next); persist(next) }} onClose={...} />`. Wire `WidgetGrid`'s `onConfigure={(id) => setConfiguringId(id)}`.
- Keep the empty-state + full-bleed wrapper + PageHeader from Phase 1.

Because this is large, implement incrementally and run `npx tsc --noEmit` frequently. Reuse Phase 1's `uuid`, `DEFAULT_LAYOUT`, debounced `persist` (now targeting `activeId`).

- [ ] **Step 3:** `npx tsc --noEmit` → 0; `npm run build` → compiled.

- [ ] **Step 4: Commit**
```
git add components/dashboard/board-bar.tsx "app/(app)/dashboard/page.tsx"
git commit -m "feat(dashboard): multi-board switcher, shared boards, role-template admin, widget config wiring"
```

---

## Task 7: Full verification

- [ ] **Step 1:** `npx vitest run` → all pass (Phase 1 + new config/template tests).
- [ ] **Step 2:** `npm run build` → compiled successfully.
- [ ] **Step 3: Manual smoke (dev):** add a Links widget → configure (gear) → add links → they open in new tabs; add an Embed widget → set an embeddable URL (renders) and a refusing URL (fallback "Open in new tab" appears within ~4s); create a personal board, switch boards, rename, delete; as an admin, create a shared board and (with manage-templates) tag it to a role; confirm a fresh user at that role inherits the template layout on first load.
- [ ] **Step 4:** Final commit if smoke fixes needed.

---

## Self-review notes (author)
- **Spec coverage:** links widget (T3), web embed + refusal fallback + CSP (T4), per-user + base-shared boards (T5/T6), admin role-default templates new users inherit (T5 seeding + T6 admin), widget config editing (T1/T2). No migration needed (Phase 1 schema already has `scope`/`role_template`/permissions).
- **Offline-queue:** layout writes still go through `saveBoardLayout`. Board metadata writes (create/rename/delete/share/template) are infrequent admin/structural actions done online via the CRUD module with toast-on-error — they are NOT layout writes; acceptable to run online (a failed create simply toasts and the user retries). If offline-resilience for board creation is later wanted, wrap in the queue then.
- **RLS:** shared-board writes rely on the Phase-1 `dashboard_boards_shared_write` policy (`dashboard:publish-shared`). The UI also gates the controls, but RLS is the real boundary.
- **Verify-before-implement:** Task 3/4 button text token, Task 6 `USER_ROLES` shape + role-key list for the template selector — confirm against `lib/constants.ts` (and prefer `getRoleLabel` from `lib/airport-mode.ts` for mode-aware labels).
