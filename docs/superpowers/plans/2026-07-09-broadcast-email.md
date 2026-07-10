# Broadcast Email (Email All Users) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a System Administrator compose a rich-formatted (Markdown) email in `/users` and send it to all active account holders (with optional base/role filters), with a live preview, a test-send, a confirm-with-count, and an audit record — deliverable to `.mil` inboxes.

**Architecture:** Four pure, fully-tested units — a safe-subset Markdown renderer, a branded email builder, recipient helpers — plus one sys-admin API route (`count` / `test` / `send` modes) that fans out **individual** emails via Resend's Batch API and writes an `email_broadcasts` audit row, and a compose modal wired into the existing `/users` page. The renderer escapes-then-formats with no linkify, so the output is a fixed tag allowlist that **cannot** emit external links or images.

**Tech Stack:** Next.js 14 App Router (route handlers), TypeScript strict, Resend 6.9.3, Supabase (service-role for reads/writes), Vitest + Testing Library, Postgres RLS via the permission-matrix helpers.

**Spec:** `docs/superpowers/specs/2026-07-09-broadcast-email-design.md`

## Global Constraints

- **Repo:** `airfield-app` (`C:/Users/cspro/airfield-app`). Run all commands from its root.
- **Commits are LOCAL and UNPUSHED.** The owner pushes. Never push.
- **Gate before each commit:** `npx tsc --noEmit` (0 errors) · `npm run lint` (0 errors) · `npx vitest run` (all pass) · `npm run build` (RC 0). Pre-existing warnings in `lib/waiver-pdf.ts` are fine (0 errors ≠ 0 warnings).
- **Deliverability (hard rule):** email HTML contains **no `<a href="http(s)://…">`** and **no `<img>`**. `mailto:` in the template footer is allowed. Every send includes a `text/plain` part.
- **Permission:** System Admin only (`profiles.role === 'sys_admin'`), enforced server-side (403 otherwise) and in the UI (button hidden otherwise).
- **RLS:** use the matrix helper `public.user_is_sys_admin(auth.uid())`. Never the dropped helpers (`user_can_write`/`user_is_admin`/`user_is_base_admin_at`).
- **Migrations:** never `supabase db push`. Apply with `npx supabase db query --linked --file <path>` (owner/linked access). File name `YYYYMMDDXX_<name>.sql`.
- **Email identity:** `from: 'Glidepath <info@glidepathops.com>'`, `replyTo: 'info@glidepathops.com'`.
- **Commit trailer (every commit):**
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_016n621MSZmyZKZcA3qKJzsw
  ```

## File Structure

| File | Responsibility |
|---|---|
| `lib/email/safe-markdown.ts` (create) | `renderSafeMarkdown`, `markdownToPlainText`, `escapeHtml` — the only place formatting lives |
| `tests/safe-markdown.test.ts` (create) | Formatting + adversarial no-link/no-image guard |
| `lib/email/broadcast-template.ts` (create) | `buildBroadcastEmail` — wrap rendered body in the branded shell |
| `tests/broadcast-template.test.ts` (create) | Greeting/footer/disclaimer; no `http` links; text fallback |
| `lib/email/broadcast-recipients.ts` (create) | `normalizeRecipients`, `chunk` — pure recipient helpers |
| `tests/broadcast-recipients.test.ts` (create) | Dedupe/validate; chunking |
| `lib/email/broadcast-senders.ts` (create, Task 8) | `BROADCAST_SENDERS` allowlist + `findSender`/`formatFrom` — validated From selection |
| `tests/broadcast-senders.test.ts` (create, Task 8) | Allowlist lookup + default |
| `supabase/migrations/2026070900_email_broadcasts.sql` (create) | Audit table + sys-admin RLS |
| `app/api/admin/broadcast-email/route.ts` (create) | POST `count`/`test`/`send`; sys-admin gate; fan-out; audit |
| `tests/broadcast-email-route.test.ts` (create) | 403 gate; count; send delegates + audit |
| `components/admin/broadcast-email-modal.tsx` (create) | Compose modal: toolbar+markdown, preview, filters, count, test, confirm, send |
| `tests/broadcast-email-modal.test.tsx` (create) | Preview renders; toolbar inserts; buttons call API |
| `app/(app)/users/page.tsx` (modify) | Sys-admin "Email all users" button → modal |

---

### Task 1: Safe-subset Markdown renderer

**Files:**
- Create: `lib/email/safe-markdown.ts`
- Test: `tests/safe-markdown.test.ts`

**Interfaces:**
- Produces: `renderSafeMarkdown(md: string): string` (HTML of allowlisted tags only), `markdownToPlainText(md: string): string`, `escapeHtml(s: string): string`.

- [ ] **Step 1: Write the failing test**

Create `tests/safe-markdown.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { renderSafeMarkdown, markdownToPlainText, escapeHtml } from '@/lib/email/safe-markdown'

describe('renderSafeMarkdown — formatting', () => {
  it('renders h2/h3 headers', () => {
    expect(renderSafeMarkdown('## Title')).toBe('<h2>Title</h2>')
    expect(renderSafeMarkdown('### Sub')).toBe('<h3>Sub</h3>')
  })
  it('renders bullet and numbered lists', () => {
    expect(renderSafeMarkdown('- a\n- b')).toBe('<ul><li>a</li><li>b</li></ul>')
    expect(renderSafeMarkdown('1. a\n2. b')).toBe('<ol><li>a</li><li>b</li></ol>')
  })
  it('renders bold and italic', () => {
    expect(renderSafeMarkdown('**b** and *i* and _j_')).toBe('<p><strong>b</strong> and <em>i</em> and <em>j</em></p>')
  })
  it('separates paragraphs on blank lines and keeps single newlines as <br>', () => {
    expect(renderSafeMarkdown('one\ntwo\n\nthree')).toBe('<p>one<br>two</p>\n<p>three</p>')
  })
})

describe('renderSafeMarkdown — deliverability guard (no links/images survive)', () => {
  for (const evil of [
    '[click](http://evil.com)',
    'visit http://evil.com now',
    '<a href="http://evil.com">x</a>',
    '<img src="http://evil.com/p.png">',
    '<script>alert(1)</script>',
  ]) {
    it(`neutralizes: ${evil}`, () => {
      const html = renderSafeMarkdown(evil)
      expect(html).not.toMatch(/<a/i)
      expect(html).not.toMatch(/<img/i)
      expect(html).not.toMatch(/<script/i)
    })
  }
})

describe('markdownToPlainText', () => {
  it('strips formatting markers', () => {
    expect(markdownToPlainText('## Title\n\n- a\n- b\n\n**bold**')).toBe('Title\n\na\nb\n\nbold')
  })
})

describe('escapeHtml', () => {
  it('escapes the dangerous five', () => {
    expect(escapeHtml('<a href="x">&\'')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;\'')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/safe-markdown.test.ts`
Expected: FAIL — cannot resolve `@/lib/email/safe-markdown`.

- [ ] **Step 3: Write the implementation**

Create `lib/email/safe-markdown.ts`:

```ts
// The ONLY place broadcast-email formatting lives. Escapes-then-formats with no
// linkify step, so the output is a fixed allowlist of tags (p, br, strong, em,
// ul, ol, li, h2, h3) and can never emit <a> or <img> — the .mil deliverability
// guarantee (see feedback_mil_email_deliverability). Any other Markdown/HTML the
// user types is escaped and shown as literal text.

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Inline formatting, applied to ALREADY-ESCAPED text. Bold before italic so
// `**x**` is not mis-read as two italics.
function renderInline(escaped: string): string {
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
}

export function renderSafeMarkdown(md: string): string {
  const lines = (md || '').replace(/\r\n/g, '\n').split('\n')
  const blocks: string[] = []
  let i = 0
  const cell = (raw: string) => renderInline(escapeHtml(raw))

  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') { i++; continue }

    const h = /^(#{2,3})\s+(.*)$/.exec(line)
    if (h) {
      const level = h[1].length // 2 or 3
      blocks.push(`<h${level}>${cell(h[2].trim())}</h${level}>`)
      i++
      continue
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(`<li>${cell(lines[i].replace(/^[-*]\s+/, ''))}</li>`)
        i++
      }
      blocks.push(`<ul>${items.join('')}</ul>`)
      continue
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${cell(lines[i].replace(/^\d+\.\s+/, ''))}</li>`)
        i++
      }
      blocks.push(`<ol>${items.join('')}</ol>`)
      continue
    }

    const para: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{2,3})\s+/.test(lines[i]) &&
      !/^[-*]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i])
    ) {
      para.push(cell(lines[i]))
      i++
    }
    blocks.push(`<p>${para.join('<br>')}</p>`)
  }

  return blocks.join('\n')
}

export function markdownToPlainText(md: string): string {
  return (md || '')
    .replace(/\r\n/g, '\n')
    .replace(/^#{2,3}\s+/gm, '')   // headers
    .replace(/^[-*]\s+/gm, '')      // bullets
    .replace(/^\d+\.\s+/gm, '')     // numbers
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .trim()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/safe-markdown.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/email/safe-markdown.ts tests/safe-markdown.test.ts
git commit -m "$(cat <<'EOF'
Broadcast email: safe-subset Markdown renderer

Escapes-then-formats with no linkify, emitting only an allowlist of formatting
tags (p/br/strong/em/ul/ol/li/h2/h3). No <a>/<img> can survive — the .mil
no-external-links guarantee, locked by adversarial tests.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016n621MSZmyZKZcA3qKJzsw
EOF
)"
```

---

### Task 2: Branded broadcast email builder

**Files:**
- Create: `lib/email/broadcast-template.ts`
- Test: `tests/broadcast-template.test.ts`

**Interfaces:**
- Consumes: `renderSafeMarkdown`, `markdownToPlainText`, `escapeHtml` from Task 1.
- Produces: `buildBroadcastEmail(input: { recipientName: string; subject: string; bodyMarkdown: string }): { subject: string; html: string; text: string }`.

- [ ] **Step 1: Write the failing test**

Create `tests/broadcast-template.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildBroadcastEmail } from '@/lib/email/broadcast-template'

describe('buildBroadcastEmail', () => {
  const built = buildBroadcastEmail({
    recipientName: 'MSgt Proctor',
    subject: 'Glidepath update',
    bodyMarkdown: '## Whats new\n\n- Item one\n- Item two\n\nGo to app.glidepathops.com and select Sign In.',
  })

  it('greets the recipient by name and includes rendered formatting', () => {
    expect(built.html).toContain('Hello MSgt Proctor,')
    expect(built.html).toContain('<h2>Whats new</h2>')
    expect(built.html).toContain('<li>Item one</li>')
  })
  it('has the branded header and the DoD disclaimer footer', () => {
    expect(built.html).toContain('GLIDEPATH')
    expect(built.html).toMatch(/not endorsed by.*Department of Defense/i)
  })
  it('contains NO http(s) links and NO images (mailto is allowed)', () => {
    expect(built.html).not.toMatch(/href=["']https?:/i)
    expect(built.html).not.toMatch(/<img/i)
    expect(built.html).toContain('mailto:info@glidepathops.com')
  })
  it('provides a plain-text fallback derived from the markdown', () => {
    expect(built.text).toContain('Hello MSgt Proctor,')
    expect(built.text).toContain('Whats new')
    expect(built.text).not.toContain('##')
  })
  it('falls back to a neutral greeting when name is empty', () => {
    const b = buildBroadcastEmail({ recipientName: '', subject: 's', bodyMarkdown: 'hi' })
    expect(b.html).toContain('Hello there,')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/broadcast-template.test.ts`
Expected: FAIL — cannot resolve `@/lib/email/broadcast-template`.

- [ ] **Step 3: Write the implementation**

Create `lib/email/broadcast-template.ts`:

```ts
import { renderSafeMarkdown, markdownToPlainText, escapeHtml } from './safe-markdown'

export interface BroadcastEmailInput {
  recipientName: string
  subject: string
  bodyMarkdown: string
}
export interface BuiltEmail {
  subject: string
  html: string
  text: string
}

const DISCLAIMER =
  'Glidepath is not endorsed by, affiliated with, or associated with the Department of Defense (DoD) or any branch of the U.S. Armed Forces.'

export function buildBroadcastEmail({ recipientName, subject, bodyMarkdown }: BroadcastEmailInput): BuiltEmail {
  const name = recipientName?.trim() || 'there'
  const bodyHtml = renderSafeMarkdown(bodyMarkdown)

  const html = [
    '<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;line-height:1.55">',
    '<div style="background:#0b1f33;color:#ffffff;padding:16px 24px;font-weight:700;letter-spacing:0.06em;font-size:18px">GLIDEPATH</div>',
    '<div style="padding:24px 24px 8px">',
    `<p>Hello ${escapeHtml(name)},</p>`,
    bodyHtml,
    '</div>',
    '<div style="padding:16px 24px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px">',
    '<p>Questions? Contact <a href="mailto:info@glidepathops.com">info@glidepathops.com</a>.</p>',
    `<p>${DISCLAIMER}</p>`,
    '</div>',
    '</div>',
  ].join('\n')

  const text = [
    `Hello ${name},`,
    '',
    markdownToPlainText(bodyMarkdown),
    '',
    '—',
    'Questions? Contact info@glidepathops.com.',
    DISCLAIMER,
  ].join('\n')

  return { subject, html, text }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/broadcast-template.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/email/broadcast-template.ts tests/broadcast-template.test.ts
git commit -m "$(cat <<'EOF'
Broadcast email: branded email builder

Wraps the safe-rendered body in a branded, self-contained HTML shell (no remote
images, mailto footer only) with a personalized greeting and a text/plain
fallback. Guard test asserts no http(s) links.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016n621MSZmyZKZcA3qKJzsw
EOF
)"
```

---

### Task 3: Recipient helpers (normalize + chunk)

**Files:**
- Create: `lib/email/broadcast-recipients.ts`
- Test: `tests/broadcast-recipients.test.ts`

**Interfaces:**
- Produces: `Recipient { email: string; name: string }`; `normalizeRecipients(rows: Array<{ email: string | null; name: string | null }>): Recipient[]`; `chunk<T>(arr: T[], size: number): T[][]`.

- [ ] **Step 1: Write the failing test**

Create `tests/broadcast-recipients.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { normalizeRecipients, chunk } from '@/lib/email/broadcast-recipients'

describe('normalizeRecipients', () => {
  it('drops empty/invalid emails, dedupes case-insensitively, trims names', () => {
    const out = normalizeRecipients([
      { email: 'A@x.com', name: ' Amy ' },
      { email: 'a@x.com', name: 'Amy dup' }, // dup (case-insensitive)
      { email: '', name: 'No email' },
      { email: 'notanemail', name: 'Bad' },
      { email: 'b@x.com', name: null },
    ])
    expect(out).toEqual([
      { email: 'a@x.com', name: 'Amy' },
      { email: 'b@x.com', name: '' },
    ])
  })
})

describe('chunk', () => {
  it('splits into fixed-size groups', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })
  it('returns [] for empty input and throws on non-positive size', () => {
    expect(chunk([], 100)).toEqual([])
    expect(() => chunk([1], 0)).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/broadcast-recipients.test.ts`
Expected: FAIL — cannot resolve `@/lib/email/broadcast-recipients`.

- [ ] **Step 3: Write the implementation**

Create `lib/email/broadcast-recipients.ts`:

```ts
export interface Recipient {
  email: string
  name: string
}

export function normalizeRecipients(
  rows: Array<{ email: string | null; name: string | null }>,
): Recipient[] {
  const seen = new Set<string>()
  const out: Recipient[] = []
  for (const r of rows) {
    const email = (r.email || '').trim().toLowerCase()
    if (!email || !email.includes('@')) continue
    if (seen.has(email)) continue
    seen.add(email)
    out.push({ email, name: (r.name || '').trim() })
  }
  return out
}

export function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) throw new Error('chunk size must be > 0')
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/broadcast-recipients.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/email/broadcast-recipients.ts tests/broadcast-recipients.test.ts
git commit -m "$(cat <<'EOF'
Broadcast email: recipient normalize + chunk helpers

Dedupe by lowercased email, drop empty/invalid addresses, and chunk into
batch-sized groups for Resend's Batch API.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016n621MSZmyZKZcA3qKJzsw
EOF
)"
```

---

### Task 4: `email_broadcasts` audit table (migration)

**Files:**
- Create: `supabase/migrations/2026070900_email_broadcasts.sql`

**Interfaces:**
- Produces: table `public.email_broadcasts (id, sender_id, subject, body, filters jsonb, recipient_count, sent_count, failed_count, created_at)` with sys-admin RLS. Consumed by the route in Task 5.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/2026070900_email_broadcasts.sql`:

```sql
-- Audit log for System-Admin broadcast emails ("Email all users").
-- Additive, new table — no expand/contract concern.
create table if not exists public.email_broadcasts (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references public.profiles(id) on delete set null,
  subject text not null,
  body text not null,
  filters jsonb not null default '{}'::jsonb,
  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.email_broadcasts enable row level security;

-- Server writes use the service-role key (bypasses RLS). These policies are
-- defense-in-depth so no anon/auth client can read or forge broadcast rows.
drop policy if exists email_broadcasts_select on public.email_broadcasts;
create policy email_broadcasts_select on public.email_broadcasts
  for select using (public.user_is_sys_admin(auth.uid()));

drop policy if exists email_broadcasts_insert on public.email_broadcasts;
create policy email_broadcasts_insert on public.email_broadcasts
  for insert with check (public.user_is_sys_admin(auth.uid()));
```

- [ ] **Step 2: Apply to the linked DB and verify**

Run (owner/linked access — never `db push`):

```bash
npx supabase db query --linked --file supabase/migrations/2026070900_email_broadcasts.sql
```

Verify the table and RLS exist:

```bash
printf "select relrowsecurity, (select count(*) from pg_policies where tablename='email_broadcasts') as policies from pg_class where relname='email_broadcasts';" > /tmp/verify.sql
npx supabase db query --linked --file /tmp/verify.sql
```

Expected: one row, `relrowsecurity = t`, `policies = 2`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/2026070900_email_broadcasts.sql
git commit -m "$(cat <<'EOF'
Broadcast email: email_broadcasts audit table + sys-admin RLS

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016n621MSZmyZKZcA3qKJzsw
EOF
)"
```

---

### Task 5: API route (`count` / `test` / `send`)

**Files:**
- Create: `app/api/admin/broadcast-email/route.ts`
- Test: `tests/broadcast-email-route.test.ts`

**Interfaces:**
- Consumes: `buildBroadcastEmail` (Task 2); `normalizeRecipients`, `chunk` (Task 3); `email_broadcasts` (Task 4).
- Produces: `POST /api/admin/broadcast-email` with body `{ mode: 'count' | 'test' | 'send'; filters?: { baseIds?: string[]; roles?: string[] }; subject?: string; body?: string }`. Responses: `count` → `{ recipientCount }`; `test` → `{ success: true }`; `send` → `{ recipientCount, sent, failed }`. Non-sys_admin → 403.

- [ ] **Step 1: Write the failing test**

Create `tests/broadcast-email-route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──
const getUser = vi.fn()
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser: getUser } }),
}))
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [] }) }))

const batchSend = vi.fn()
const emailSend = vi.fn()
vi.mock('resend', () => ({
  Resend: class {
    batch = { send: batchSend }
    emails = { send: emailSend }
  },
}))

// admin client: profiles(caller) + resolveRecipients query + insert
let callerRole = 'sys_admin'
let recipientRows: Array<{ email: string; name: string }> = []
const insert = vi.fn().mockResolvedValue({ error: null })
function makeAdmin() {
  return {
    from(table: string) {
      if (table === 'email_broadcasts') return { insert }
      // profiles
      const builder: any = {
        _filters: [] as string[],
        select() { return builder },
        eq(col: string) {
          if (col === 'id') {
            // caller profile lookup
            return { single: async () => ({ data: { role: callerRole, email: 'admin@x.com', name: 'Admin' } }) }
          }
          return builder // .eq('status','active')
        },
        in() { return builder },
        then(resolve: (v: { data: unknown; error: null }) => void) {
          // recipient query resolves as a thenable
          resolve({ data: recipientRows, error: null })
        },
      }
      return builder
    },
  }
}
vi.mock('@supabase/supabase-js', () => ({ createClient: () => makeAdmin() }))

async function callRoute(body: unknown) {
  const { POST } = await import('@/app/api/admin/broadcast-email/route')
  const res = await POST(new Request('http://localhost/api/admin/broadcast-email', {
    method: 'POST',
    body: JSON.stringify(body),
  }))
  return { status: res.status, json: await res.json() }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
  process.env.RESEND_API_KEY = 'resend'
  getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
  callerRole = 'sys_admin'
  recipientRows = [{ email: 'a@x.com', name: 'A' }, { email: 'b@x.com', name: 'B' }]
  batchSend.mockResolvedValue({ data: {}, error: null })
})

describe('POST /api/admin/broadcast-email', () => {
  it('403s a non-sys_admin caller', async () => {
    callerRole = 'base_admin'
    const { status } = await callRoute({ mode: 'count' })
    expect(status).toBe(403)
  })

  it('count returns the resolved recipient count', async () => {
    const { status, json } = await callRoute({ mode: 'count' })
    expect(status).toBe(200)
    expect(json.recipientCount).toBe(2)
  })

  it('send batches emails, writes an audit row, and returns the tally', async () => {
    const { status, json } = await callRoute({ mode: 'send', subject: 'Hi', body: 'Body' })
    expect(status).toBe(200)
    expect(batchSend).toHaveBeenCalledTimes(1)
    expect(batchSend.mock.calls[0][0]).toHaveLength(2) // one email per recipient
    expect(insert).toHaveBeenCalledTimes(1)
    expect(json).toMatchObject({ recipientCount: 2, sent: 2, failed: 0 })
  })

  it('send 400s when no recipients match', async () => {
    recipientRows = []
    const { status } = await callRoute({ mode: 'send', subject: 'Hi', body: 'Body' })
    expect(status).toBe(400)
  })
})
```

Note: the mock's `profiles` query builder is a thenable so `await q` resolves to the recipient rows; `.eq('id', …)` returns the caller lookup. If the real code shape differs, adjust the builder — the assertions (403/count/send tally/audit) are the contract.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/broadcast-email-route.test.ts`
Expected: FAIL — cannot resolve `@/app/api/admin/broadcast-email/route`.

- [ ] **Step 3: Write the implementation**

Create `app/api/admin/broadcast-email/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Resend } from 'resend'
import { buildBroadcastEmail } from '@/lib/email/broadcast-template'
import { normalizeRecipients, chunk, type Recipient } from '@/lib/email/broadcast-recipients'

let _resend: Resend | null = null
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

const CHUNK_SIZE = 100
const FROM = 'Glidepath <info@glidepathops.com>'
const REPLY_TO = 'info@glidepathops.com'

interface Body {
  mode: 'count' | 'test' | 'send'
  filters?: { baseIds?: string[]; roles?: string[] }
  subject?: string
  body?: string
}

function clean(v: string | undefined) {
  return v?.trim().replace(/^["']|["']$/g, '')
}

export async function POST(request: Request) {
  try {
    const url = clean(process.env.NEXT_PUBLIC_SUPABASE_URL)
    const anon = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    const serviceKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
    if (!url || !anon || !serviceKey) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(url, anon, {
      cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
    })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { createClient } = await import('@supabase/supabase-js')
    const admin = createClient(url, serviceKey)

    const { data: caller } = await admin
      .from('profiles')
      .select('role, email, name')
      .eq('id', user.id)
      .single()

    if (!caller || caller.role !== 'sys_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { mode, filters, subject, body } = (await request.json()) as Body

    const resolveRecipients = async (): Promise<Recipient[]> => {
      let q = admin.from('profiles').select('email, name').eq('status', 'active')
      if (filters?.baseIds?.length) q = q.in('primary_base_id', filters.baseIds)
      if (filters?.roles?.length) q = q.in('role', filters.roles)
      const { data, error } = await q
      if (error) throw new Error(error.message)
      return normalizeRecipients((data as Array<{ email: string | null; name: string | null }>) || [])
    }

    if (mode === 'count') {
      const recipients = await resolveRecipients()
      return NextResponse.json({ recipientCount: recipients.length })
    }

    if (!subject?.trim() || !body?.trim()) {
      return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 })
    }
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
    }
    const resend = getResend()

    if (mode === 'test') {
      if (!caller.email) {
        return NextResponse.json({ error: 'Your account has no email on file' }, { status: 400 })
      }
      const built = buildBroadcastEmail({ recipientName: caller.name || caller.email, subject, bodyMarkdown: body })
      const { error } = await resend.emails.send({
        from: FROM, replyTo: REPLY_TO, to: caller.email,
        subject: `[TEST] ${built.subject}`, html: built.html, text: built.text,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (mode === 'send') {
      const recipients = await resolveRecipients()
      if (recipients.length === 0) {
        return NextResponse.json({ error: 'No recipients match the selected filters' }, { status: 400 })
      }
      let sent = 0
      let failed = 0
      for (const group of chunk(recipients, CHUNK_SIZE)) {
        const emails = group.map((r) => {
          const built = buildBroadcastEmail({ recipientName: r.name || r.email, subject, bodyMarkdown: body })
          return { from: FROM, replyTo: REPLY_TO, to: r.email, subject: built.subject, html: built.html, text: built.text }
        })
        const { error } = await resend.batch.send(emails)
        if (error) failed += group.length
        else sent += group.length
      }

      // Audit write is best-effort — a send already happened; never report the
      // whole broadcast as failed just because the audit row didn't persist.
      try {
        await admin.from('email_broadcasts').insert({
          sender_id: user.id, subject, body, filters: filters ?? {},
          recipient_count: recipients.length, sent_count: sent, failed_count: failed,
        })
      } catch (e) {
        console.error('[broadcast-email] audit insert failed:', e)
      }

      return NextResponse.json({ recipientCount: recipients.length, sent, failed })
    }

    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
  } catch (err) {
    console.error('[broadcast-email] Error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unexpected server error' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/broadcast-email-route.test.ts`
Expected: PASS. If the thenable mock needs tweaking to match the query chain, adjust the mock builder (not the route) until 403/count/send/audit assertions pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/broadcast-email/route.ts tests/broadcast-email-route.test.ts
git commit -m "$(cat <<'EOF'
Broadcast email: sys-admin API route (count/test/send)

Resolves active recipients server-side (never from the body), fans out
individual emails via Resend batch, and writes a best-effort email_broadcasts
audit row. Non-sys_admin -> 403.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016n621MSZmyZKZcA3qKJzsw
EOF
)"
```

---

### Task 6: Compose modal

**Files:**
- Create: `components/admin/broadcast-email-modal.tsx`
- Test: `tests/broadcast-email-modal.test.tsx`

**Interfaces:**
- Consumes: `renderSafeMarkdown` (Task 1) for the live preview; the route (Task 5) via `fetch`.
- Produces: `BroadcastEmailModal({ onClose, bases, callerName }: { onClose: () => void; bases: Array<{ id: string; name: string }>; callerName: string })`.

- [ ] **Step 1: Write the failing test**

Create `tests/broadcast-email-modal.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BroadcastEmailModal } from '@/components/admin/broadcast-email-modal'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ recipientCount: 5 }) })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

function setup() {
  return render(
    <BroadcastEmailModal onClose={() => {}} callerName="MSgt Proctor" bases={[{ id: 'b1', name: 'Demo AFB' }]} />,
  )
}

describe('BroadcastEmailModal', () => {
  it('renders the live preview from the message markdown', async () => {
    const { container } = setup()
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: '## Hi\n\n- one' } })
    await waitFor(() => {
      const preview = container.querySelector('[data-testid="broadcast-preview"]')!
      expect(preview.innerHTML).toContain('<h2>Hi</h2>')
      expect(preview.innerHTML).toContain('<li>one</li>')
    })
  })

  it('the Bullet toolbar button inserts a "- " token', () => {
    setup()
    const msg = screen.getByLabelText(/message/i) as HTMLTextAreaElement
    fireEvent.change(msg, { target: { value: 'line' } })
    fireEvent.click(screen.getByRole('button', { name: /bullet/i }))
    expect(msg.value).toContain('- ')
  })

  it('Send test posts mode=test with subject+body', async () => {
    setup()
    fireEvent.change(screen.getByLabelText(/subject/i), { target: { value: 'S' } })
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'B' } })
    fireEvent.click(screen.getByRole('button', { name: /send test to myself/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const lastBody = JSON.parse(fetchMock.mock.calls.at(-1)![1].body)
    expect(lastBody).toMatchObject({ mode: 'test', subject: 'S', body: 'B' })
  })

  it('Send requires confirmation before posting mode=send', async () => {
    setup()
    fireEvent.change(screen.getByLabelText(/subject/i), { target: { value: 'S' } })
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'B' } })
    fireEvent.click(screen.getByRole('button', { name: /^send to/i }))
    // confirm dialog appears; posting happens only after confirming
    fireEvent.click(screen.getByRole('button', { name: /confirm send/i }))
    await waitFor(() => {
      const modes = fetchMock.mock.calls.map((c) => JSON.parse(c[1].body).mode)
      expect(modes).toContain('send')
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/broadcast-email-modal.test.tsx`
Expected: FAIL — cannot resolve `@/components/admin/broadcast-email-modal`.

- [ ] **Step 3: Write the implementation**

Create `components/admin/broadcast-email-modal.tsx`:

```tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { USER_ROLES } from '@/lib/constants'
import type { UserRole } from '@/lib/supabase/types'
import { renderSafeMarkdown } from '@/lib/email/safe-markdown'

interface Props {
  onClose: () => void
  bases: Array<{ id: string; name: string }>
  callerName: string
}

const API = '/api/admin/broadcast-email'

export function BroadcastEmailModal({ onClose, bases, callerName }: Props) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [baseIds, setBaseIds] = useState<string[]>([])
  const [roles, setRoles] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [count, setCount] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const msgRef = useRef<HTMLTextAreaElement>(null)

  const filters = useMemo(
    () => ({ baseIds: baseIds.length ? baseIds : undefined, roles: roles.length ? roles : undefined }),
    [baseIds, roles],
  )

  // Live recipient count (debounced) whenever filters change.
  useEffect(() => {
    let alive = true
    const t = setTimeout(async () => {
      try {
        const res = await fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'count', filters }),
        })
        const json = await res.json()
        if (alive && res.ok) setCount(json.recipientCount)
      } catch { /* ignore count errors */ }
    }, 300)
    return () => { alive = false; clearTimeout(t) }
  }, [filters])

  const previewHtml = useMemo(() => renderSafeMarkdown(body), [body])

  function insert(token: string, wrap = false) {
    const el = msgRef.current
    if (!el) { setBody((b) => b + token); return }
    const start = el.selectionStart ?? body.length
    const end = el.selectionEnd ?? body.length
    const sel = body.slice(start, end)
    const next = wrap
      ? body.slice(0, start) + token + sel + token + body.slice(end)
      : body.slice(0, start) + token + body.slice(start)
    setBody(next)
    requestAnimationFrame(() => el.focus())
  }

  const roleOptions = Object.entries(USER_ROLES).map(([key, cfg]) => ({
    value: key as UserRole,
    label: (cfg as { label: string }).label,
  }))

  function toggle(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
  }

  async function post(mode: 'test' | 'send') {
    if (!subject.trim() || !body.trim()) { toast.error('Subject and message are required'); return }
    setBusy(true)
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, filters, subject, body }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || 'Send failed'); return }
      if (mode === 'test') toast.success('Test sent to your inbox.')
      else {
        toast.success(`Sent to ${json.sent} user${json.sent === 1 ? '' : 's'}${json.failed ? ` · ${json.failed} failed` : ''}.`)
        onClose()
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Send failed')
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card" style={{ width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', padding: 20 }}>
        <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, marginBottom: 4 }}>Email all users</div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', marginBottom: 16 }}>
          {count === null ? 'Counting recipients…' : `This will email ${count} active user${count === 1 ? '' : 's'}.`}
        </div>

        <label className="section-label" htmlFor="bc-subject">Subject</label>
        <input id="bc-subject" className="input-dark" style={{ width: '100%', marginBottom: 12 }} value={subject} onChange={(e) => setSubject(e.target.value)} />

        <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => insert('## ')} className="chip">Header</button>
          <button type="button" onClick={() => insert('**', true)} className="chip">Bold</button>
          <button type="button" onClick={() => insert('*', true)} className="chip">Italic</button>
          <button type="button" onClick={() => insert('- ')} className="chip" aria-label="Bullet list">Bullet</button>
          <button type="button" onClick={() => insert('1. ')} className="chip" aria-label="Numbered list">Numbered</button>
        </div>
        <label className="section-label" htmlFor="bc-body">Message</label>
        <textarea id="bc-body" ref={msgRef} className="input-dark" style={{ width: '100%', minHeight: 160, marginBottom: 12, fontFamily: 'inherit' }} value={body} onChange={(e) => setBody(e.target.value)} />

        <div style={{ marginBottom: 12 }}>
          <div className="section-label" style={{ marginBottom: 6 }}>Preview</div>
          <div data-testid="broadcast-preview" style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 12, background: '#ffffff', color: '#0f172a' }} dangerouslySetInnerHTML={{ __html: `<p>Hello ${callerName || 'there'},</p>` + previewHtml }} />
        </div>

        <button type="button" className="chip" onClick={() => setShowFilters((v) => !v)} style={{ marginBottom: 8 }}>
          {showFilters ? 'Hide filters' : 'Filter recipients (optional)'}
        </button>
        {showFilters && (
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div className="section-label">Bases</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {bases.map((b) => (
                <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-sm)' }}>
                  <input type="checkbox" checked={baseIds.includes(b.id)} onChange={() => toggle(baseIds, setBaseIds, b.id)} /> {b.name}
                </label>
              ))}
            </div>
            <div className="section-label">Roles</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {roleOptions.map((r) => (
                <label key={r.value} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-sm)' }}>
                  <input type="checkbox" checked={roles.includes(r.value)} onChange={() => toggle(roles, setRoles, r.value)} /> {r.label}
                </label>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
          <button type="button" onClick={onClose} className="chip" disabled={busy}>Cancel</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => post('test')} className="chip" disabled={busy}>Send test to myself</button>
            <button type="button" onClick={() => setConfirming(true)} className="btn-primary" disabled={busy || !count}>
              Send to {count ?? 0}
            </button>
          </div>
        </div>

        {confirming && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 401, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div className="card" style={{ maxWidth: 380, padding: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Send to {count} users?</div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', marginBottom: 16 }}>“{subject}” — this cannot be undone.</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="chip" onClick={() => setConfirming(false)} disabled={busy}>Cancel</button>
                <button type="button" className="btn-primary" onClick={() => post('send')} disabled={busy}>Confirm send</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/broadcast-email-modal.test.tsx`
Expected: PASS. (The count `useEffect` calls the mocked `fetch`; the confirm flow requires "Confirm send".)

- [ ] **Step 5: Commit**

```bash
git add components/admin/broadcast-email-modal.tsx tests/broadcast-email-modal.test.tsx
git commit -m "$(cat <<'EOF'
Broadcast email: compose modal (toolbar + markdown + live preview)

Subject + Markdown body with a formatting toolbar, a safe live preview (same
renderer as the server), optional base/role filters with a live recipient
count, send-test-to-self, and a confirm-with-count before the blast.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016n621MSZmyZKZcA3qKJzsw
EOF
)"
```

---

### Task 7: Wire the button into `/users`

**Files:**
- Modify: `app/(app)/users/page.tsx`

**Interfaces:**
- Consumes: `BroadcastEmailModal` (Task 6). Uses existing page state `isSysAdmin`, and the loaded users/bases.

**Note:** this task is verified manually (the page is ~670 lines with heavy data loading; a full render test isn't worth it — the modal and route carry the automated coverage). The change is a gated button + conditional modal, mirroring the existing `showInviteModal` pattern.

- [ ] **Step 1: Import the modal**

Near the other admin imports (after the `InviteUserModal` import, ~line 14):

```tsx
import { BroadcastEmailModal } from '@/components/admin/broadcast-email-modal'
```

- [ ] **Step 2: Add modal state + capture the caller's display name**

Next to `const [showInviteModal, setShowInviteModal] = useState(false)` (~line 121):

```tsx
const [showBroadcastModal, setShowBroadcastModal] = useState(false)
const [callerName, setCallerName] = useState('')
```

The caller profile loads at ~line 164 as `.select('role, primary_base_id')`. Add `name` and set the state (used only for the preview greeting — real sends use each recipient's own name server-side):

```tsx
// line ~164: .select('role, primary_base_id')  ->  add name:
.select('role, primary_base_id, name')
// after setCallerBaseId(profile.primary_base_id) (~line 184):
setCallerName((profile.name as string) || '')
```

- [ ] **Step 3: Add the sys-admin-only button**

In the top action row, next to the "Invite User" button (the block around `onClick={() => setShowInviteModal(true)}` / label "Invite User", ~line 438–455), add — gated on `isSysAdmin`:

```tsx
{isSysAdmin && (
  <button
    type="button"
    onClick={() => setShowBroadcastModal(true)}
    className="btn-ghost"
    style={{ marginRight: 8 }}
  >
    Email all users
  </button>
)}
```

(If the surrounding container uses a specific button style, match it — the point is a sys-admin-only trigger set apart from per-row actions. `btn-ghost`/existing classes are fine.)

- [ ] **Step 4: Render the modal conditionally**

Next to the `{showInviteModal && ( <InviteUserModal … /> )}` block (~line 545), add. The page already loads all active bases into the `installations` state (`Installation[]`, set at ~line 197) — pass those as the filter list:

```tsx
{showBroadcastModal && (
  <BroadcastEmailModal
    callerName={callerName}
    bases={installations.map((b) => ({ id: b.id, name: b.name }))}
    onClose={() => setShowBroadcastModal(false)}
  />
)}
```

- [ ] **Step 5: Verify manually**

Run: `npm run dev`, sign in as a sys_admin, open `/users`.
Expected: an "Email all users" button appears (and is absent for non-sys_admin — confirm by checking a non-sys_admin session or by reading the `isSysAdmin` gate). Click it → modal opens, recipient count loads, preview updates as you type, "Send test to myself" arrives in your inbox, and "Send to N" asks to confirm.

- [ ] **Step 6: Full gate + commit**

Run: `npx tsc --noEmit && npm run lint && npx vitest run && npm run build`
Expected: all green (0 lint errors; pre-existing `lib/waiver-pdf.ts` warnings OK).

```bash
git add "app/(app)/users/page.tsx"
git commit -m "$(cat <<'EOF'
Broadcast email: add sys-admin "Email all users" button to /users

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016n621MSZmyZKZcA3qKJzsw
EOF
)"
```

---

### Task 8: From-address selector (choose the sender)

Adds a validated **From** picker so a sys-admin can send as e.g. `chris@glidepathops.com` instead of the default `info@`. `glidepathops.com` is already Resend-verified, so no DNS/verification is needed for any `@glidepathops.com` address; the server validates the choice against a fixed allowlist so the route can't be turned into an open relay. `reply-to` follows the chosen sender (only add real mailboxes).

**Files:**
- Create: `lib/email/broadcast-senders.ts`, `tests/broadcast-senders.test.ts`
- Modify: `app/api/admin/broadcast-email/route.ts` (from Task 5) — accept + validate `from`
- Modify: `tests/broadcast-email-route.test.ts` (from Task 5) — `from` cases
- Modify: `components/admin/broadcast-email-modal.tsx` (from Task 6) — From `<select>` + payload
- Modify: `tests/broadcast-email-modal.test.tsx` (from Task 6) — From default + payload

**Interfaces:**
- Produces: `Sender { email: string; name: string }`; `BROADCAST_SENDERS: Sender[]`; `DEFAULT_SENDER: Sender`; `findSender(email: string | null | undefined): Sender | undefined`; `formatFrom(s: Sender): string` — consumed by the route and modal.
- Route body gains optional `from?: string` (a sender email). Unknown/off-list `from` → 400.

- [ ] **Step 1: Write the senders test**

Create `tests/broadcast-senders.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { BROADCAST_SENDERS, DEFAULT_SENDER, findSender, formatFrom } from '@/lib/email/broadcast-senders'

describe('broadcast senders allowlist', () => {
  it('defaults to info@glidepathops.com (first entry)', () => {
    expect(DEFAULT_SENDER.email).toBe('info@glidepathops.com')
    expect(BROADCAST_SENDERS[0]).toEqual(DEFAULT_SENDER)
  })
  it('every sender is an @glidepathops.com address', () => {
    for (const s of BROADCAST_SENDERS) expect(s.email.endsWith('@glidepathops.com')).toBe(true)
  })
  it('findSender matches case-insensitively and rejects unknowns', () => {
    expect(findSender('CHRIS@glidepathops.com')?.email).toBe('chris@glidepathops.com')
    expect(findSender('evil@attacker.com')).toBeUndefined()
    expect(findSender('')).toBeUndefined()
    expect(findSender(null)).toBeUndefined()
  })
  it('formatFrom renders "Name <email>"', () => {
    expect(formatFrom({ email: 'chris@glidepathops.com', name: 'Chris Proctor' })).toBe('Chris Proctor <chris@glidepathops.com>')
  })
})
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run tests/broadcast-senders.test.ts`
Expected: FAIL — cannot resolve `@/lib/email/broadcast-senders`.

- [ ] **Step 3: Create the module**

Create `lib/email/broadcast-senders.ts`:

```ts
// Allowlisted From identities for broadcast email. The route validates any
// chosen `from` against this list, so it can never send from an arbitrary
// address. glidepathops.com is already Resend-verified — adding a sender is a
// one-line change, no DNS. Only add REAL mailboxes: reply-to = the chosen sender.
export interface Sender {
  email: string
  name: string
}

export const BROADCAST_SENDERS: Sender[] = [
  { email: 'info@glidepathops.com', name: 'Glidepath' },
  { email: 'chris@glidepathops.com', name: 'Chris Proctor' },
]

export const DEFAULT_SENDER: Sender = BROADCAST_SENDERS[0]

export function findSender(email: string | null | undefined): Sender | undefined {
  if (!email) return undefined
  const e = email.trim().toLowerCase()
  return BROADCAST_SENDERS.find((s) => s.email.toLowerCase() === e)
}

export function formatFrom(s: Sender): string {
  return `${s.name} <${s.email}>`
}
```

- [ ] **Step 4: Run → pass**

Run: `npx vitest run tests/broadcast-senders.test.ts`
Expected: PASS.

- [ ] **Step 5: Make the route from-aware**

In `app/api/admin/broadcast-email/route.ts`:

Add the import:

```ts
import { findSender, DEFAULT_SENDER, formatFrom } from '@/lib/email/broadcast-senders'
```

**Delete** the two hardcoded constants near the top:

```ts
const FROM = 'Glidepath <info@glidepathops.com>'
const REPLY_TO = 'info@glidepathops.com'
```

Add `from` to the `Body` interface:

```ts
interface Body {
  mode: 'count' | 'test' | 'send'
  filters?: { baseIds?: string[]; roles?: string[] }
  subject?: string
  body?: string
  from?: string
}
```

Destructure `from` and resolve/validate the sender (replace the existing `const { mode, filters, subject, body } = ...` line and add the validation right after it):

```ts
const { mode, filters, subject, body, from } = (await request.json()) as Body

const sender = from ? findSender(from) : DEFAULT_SENDER
if (from && !sender) {
  return NextResponse.json({ error: 'Invalid sender address' }, { status: 400 })
}
const FROM = formatFrom(sender ?? DEFAULT_SENDER)
const REPLY_TO = (sender ?? DEFAULT_SENDER).email
```

The `test` and `send` branches already reference `FROM`/`REPLY_TO` — now per-request values. No other change.

- [ ] **Step 6: Add route test cases for `from`**

Append inside the `describe('POST /api/admin/broadcast-email', …)` block in `tests/broadcast-email-route.test.ts`:

```ts
it('rejects an off-allowlist from with 400', async () => {
  const { status } = await callRoute({ mode: 'send', subject: 'S', body: 'B', from: 'evil@attacker.com' })
  expect(status).toBe(400)
})

it('sends from the chosen allowlisted sender with matching reply-to', async () => {
  await callRoute({ mode: 'send', subject: 'S', body: 'B', from: 'chris@glidepathops.com' })
  const firstEmail = batchSend.mock.calls[0][0][0]
  expect(firstEmail.from).toBe('Chris Proctor <chris@glidepathops.com>')
  expect(firstEmail.replyTo).toBe('chris@glidepathops.com')
})
```

- [ ] **Step 7: Run route tests → pass**

Run: `npx vitest run tests/broadcast-email-route.test.ts`
Expected: PASS (including the two new `from` cases).

- [ ] **Step 8: Add the From selector to the modal**

In `components/admin/broadcast-email-modal.tsx`:

Add the import:

```ts
import { BROADCAST_SENDERS, DEFAULT_SENDER } from '@/lib/email/broadcast-senders'
```

Add state next to the other `useState`s:

```ts
const [from, setFrom] = useState(DEFAULT_SENDER.email)
```

Include `from` in the `post()` payload (change the `JSON.stringify({ mode, filters, subject, body })` line):

```ts
body: JSON.stringify({ mode, filters, subject, body, from }),
```

Add the From `<select>` immediately above the Subject label:

```tsx
<label className="section-label" htmlFor="bc-from">From</label>
<select id="bc-from" className="input-dark" style={{ width: '100%', marginBottom: 12 }} value={from} onChange={(e) => setFrom(e.target.value)}>
  {BROADCAST_SENDERS.map((s) => (
    <option key={s.email} value={s.email}>{s.name} — {s.email}</option>
  ))}
</select>
```

- [ ] **Step 9: Add a modal test for the From default + payload**

Append inside the `describe('BroadcastEmailModal', …)` block in `tests/broadcast-email-modal.test.tsx`:

```tsx
it('defaults From to info@ and includes it in the send payload', async () => {
  setup()
  expect((screen.getByLabelText(/from/i) as HTMLSelectElement).value).toBe('info@glidepathops.com')
  fireEvent.change(screen.getByLabelText(/subject/i), { target: { value: 'S' } })
  fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'B' } })
  fireEvent.click(screen.getByRole('button', { name: /send test to myself/i }))
  await waitFor(() => expect(fetchMock).toHaveBeenCalled())
  const lastBody = JSON.parse(fetchMock.mock.calls.at(-1)![1].body)
  expect(lastBody.from).toBe('info@glidepathops.com')
})
```

- [ ] **Step 10: Full gate + commit**

Run: `npx tsc --noEmit && npm run lint && npx vitest run && npm run build`
Expected: all green.

```bash
git add lib/email/broadcast-senders.ts tests/broadcast-senders.test.ts app/api/admin/broadcast-email/route.ts tests/broadcast-email-route.test.ts components/admin/broadcast-email-modal.tsx tests/broadcast-email-modal.test.tsx
git commit -m "$(cat <<'EOF'
Broadcast email: validated From-address selector

Sys-admin can send as any allowlisted @glidepathops.com identity (default info@,
e.g. chris@); reply-to follows the pick. Server rejects any off-list from (no
open relay). Domain is already Resend-verified, so adding a sender is a one-line
allowlist edit.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016n621MSZmyZKZcA3qKJzsw
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- §2 audience (active + base/role filters) → route `resolveRecipients` (Task 5) + modal filters (Task 6) ✓
- §2 sys-admin permission → route 403 gate (Task 5) + `isSysAdmin` button (Task 7) ✓
- §3 location `/users` + compose UI (toolbar/preview/test/filters/confirm) → Task 6 + Task 7 ✓
- §4/§4a branding + safe-subset renderer + no links/images + text fallback → Tasks 1, 2 ✓
- §3 From selector + §4 validated from/reply-to + §8 sender-allowlist test → Task 8 ✓
- §5 send pipeline (resolve → build → chunk → batch → tally → audit) → Task 5 ✓
- §6 `email_broadcasts` audit table + RLS → Task 4, written in Task 5 ✓
- §7 error handling (403/400/partial-failure/disabled-while-sending) → Task 5 route + Task 6 `busy` ✓
- §8 tests (renderer formatting+guard, chunking, permission, test-send) → Tasks 1,3,5,6 ✓
- §9 out of scope (attachments/scheduling/history) → not built ✓
- §10 success criteria → covered by the above ✓

**Placeholder scan:** none. Task 7's earlier open spots are resolved to the page's actual locals — a `callerName` state (added, from the augmented caller-profile select at ~line 164) and the `installations` state (`Installation[]`, already loaded at ~line 197) for the base list. All library/route/modal code is complete.

**Type consistency:** `renderSafeMarkdown`/`markdownToPlainText`/`escapeHtml` (Task 1) are consumed with the same signatures in Tasks 2 & 6; `buildBroadcastEmail({recipientName,subject,bodyMarkdown})→{subject,html,text}` matches between Tasks 2 & 5; `Recipient{email,name}`, `normalizeRecipients`, `chunk` match between Tasks 3 & 5; the route body/response shape matches between Task 5 and the modal's `fetch` calls (Task 6); `Sender`/`findSender`/`formatFrom`/`DEFAULT_SENDER` (Task 8) are used identically by the route and modal, and the route's optional `from` body field matches the modal's payload.
