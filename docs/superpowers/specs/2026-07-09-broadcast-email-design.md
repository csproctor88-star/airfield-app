# Broadcast Email to Users — Design

**Date:** 2026-07-09
**Status:** Approved (owner), ready for implementation plan.
**Repo:** `airfield-app`.

## 1. Goal

Give a System Administrator a way to email **all account holders at once** from
User Management — e.g. app-update announcements and the notice about the move to
`app.glidepathops.com` / `glidepathops.com` → "Sign In". One compose, one send,
with a preview, a test send, a confirmation, and an audit record.

## 2. Audience & permission

- **System Admin only** (`profiles.role === 'sys_admin'`), enforced both in the
  UI (button visibility) and on the server (403 otherwise). This is a global,
  cross-base action; base admins do not get it.
- **Default recipients:** all **active** account holders across every base
  (`status = 'active'` / `is_active = true`, non-empty `email`).
- **Optional filters:** narrow by **base(s)** and/or **role(s)** before sending.
  A **live recipient count** reflects the current filter ("This will email 143
  people") so the blast radius is always visible before sending.
- Pending-approval, rejected, and deactivated accounts are **excluded**.

## 3. Location & UI

- A **"Email all users"** action in User Management (`/users`,
  `app/(app)/users/page.tsx`), visible only to sys_admin, placed apart from
  per-row user actions so it can't be misfired. The compose flow mirrors the
  existing `InviteUserModal` pattern (a modal launched from the page's top
  action row).
- Opens a **compose panel/modal**:
  - **From** — a dropdown of approved `@glidepathops.com` sender identities
    (default `info@`); the server validates the choice against an allowlist.
  - **Subject** (single line) + **Message** — a **formatting toolbar** (Header,
    Bold, Italic, Bullet list, Numbered list) over a Markdown-backed text area
    (GitHub-comment style): toolbar buttons insert/wrap Markdown tokens.
  - Collapsible **filters** (base/role) with the live recipient count.
  - **Live preview** of the exact rendered, branded email.
  - **"Send test to myself"** button (sends only to the sys_admin's own address).
  - **Send** button → confirmation dialog.

## 4. Email content, formatting & branding (deliverability rules)

The **subject** and a Markdown-authored **message body** (headers, bullet and
numbered lists, bold/italic, paragraphs) are rendered to safe HTML and wrapped in
a **branded Glidepath HTML template** — inline CSS, brand colors/typography, a
text/inline header wordmark, and a footer (contact + the standard DoD
non-endorsement disclaimer).

Rich formatting is authored in **Markdown** and rendered by a small in-house
**safe-subset renderer** (§4a) rather than a general Markdown/HTML library, so the
output is a fixed allowlist of formatting tags and *cannot* emit links or images.
Hard rules, from the `.mil` deliverability lesson
(`feedback_mil_email_deliverability`):

- **Allowed formatting tags only:** `p, br, strong, em, ul, ol, li, h2, h3` —
  nothing else. Any other Markdown/HTML the user types is escaped and rendered as
  literal text.
- **No embedded external URL links** — the renderer never auto-linkifies URLs
  and never emits `<a href="http(s)://…">`; a pasted `[text](http://…)` or raw
  `<a>`/`<img>` is HTML-escaped and shown as literal text. App addresses appear
  as **plain (optionally bold) text** (`app.glidepathops.com`,
  `glidepathops.com` → select "Sign In").
- **`mailto:` contact** is rendered by the template shell (not user-authored) —
  the footer contact line only.
- **No remote images** — brand with CSS/typography and a text/inline wordmark, so
  the email is self-contained and not dependent on image loading.
- Every send includes a **`text/plain` fallback** derived from the Markdown
  source (which reads cleanly as plain text).
- Personalized greeting ("Hello {name},") using the recipient's profile name.
- **From** = a validated, allowlisted `@glidepathops.com` sender identity
  (default `Glidepath <info@glidepathops.com>`; selectable, e.g. `Chris Proctor
  <chris@glidepathops.com>`); **reply-to** = the chosen sender's address. The
  server **rejects any from not on the allowlist** — no open relay / spoofing.
  Adding a sender is a one-line allowlist edit: the domain is already
  Resend-verified, so no DNS or per-address verification is needed for any
  `@glidepathops.com` address. (Reply-to only "works" if that mailbox is real —
  the seeded senders are.)

The **"Send test to myself"** is the pre-blast deliverability check: confirm the
branded, formatted version lands in a real inbox before sending to everyone. If a
branded send is ever quarantined, styling is dialed back — links are the part
that is never added.

## 4a. Safe-subset Markdown renderer (`lib/email/safe-markdown.ts`)

A dependency-free unit, the single place formatting lives — consumed by both the
live preview (client) and the send pipeline (server):

- `renderSafeMarkdown(md: string): string` — **HTML-escapes the input first**,
  then applies a fixed set of transforms: `## `→`h2`, `### `→`h3`, `- `/`* `→
  `ul`/`li`, `1. `→`ol`/`li`, `**bold**`→`strong`, `*italic*`/`_italic_`→`em`,
  blank line → paragraph, single newline → `<br>`. Emits ONLY the allowlisted
  tags; has no linkify step, so no external link or image can survive it.
- `markdownToPlainText(md: string): string` — strips the formatting markers for
  the `text/plain` part.

Because it escapes-then-formats with no linkify, the §8 guard test can assert the
output is link-/image-free for adversarial input.

## 5. Send pipeline (server, service-role)

A single API route (sys_admin-gated, mirroring the auth pattern in
`app/api/*/user-emails`):

1. Authenticate caller; confirm `profiles.role === 'sys_admin'` via the
   service-role client. Otherwise 403.
2. **Resolve recipients server-side** from `profiles` (never from the request
   body): active accounts, apply base/role filters, non-empty email, **dedupe by
   email**. The client sends only the *filters*, not the address list.
3. **Build** each recipient's email: `renderSafeMarkdown(message)` wrapped in the
   branded shell with the "Hello {name}," greeting (HTML) and
   `markdownToPlainText(message)` for the `text/plain` part. **Chunk** recipients
   into batches of 100 and send via **Resend's Batch API**, one individual email
   per recipient (each `to:` is a single address — the recipient list is never
   exposed via To/BCC). Small delay between chunks to stay within rate limits.
4. **Tally** per-recipient success/failure.
5. Write an **audit row** (§6) and return a summary (`{ recipientCount, sent,
   failed }`).
6. For a **test send**, the same builder renders the email but `to` is only the
   caller's address; no audit row, no fan-out.

**Scale note:** sized for tens–low-hundreds of users (a handful of bases) → 1–3
batch calls, completes in-request. If the user base grows into the thousands,
move fan-out behind a queue/worker behind this same UI and route; out of scope
now.

## 6. Audit log

New table **`email_broadcasts`**:

| column | purpose |
|---|---|
| `id` | uuid pk |
| `sender_id` | `profiles.id` of the sys_admin who sent it |
| `subject` | the subject line |
| `body` | the composed message (plain text as authored) |
| `filters` | jsonb — bases/roles applied (or "all") |
| `recipient_count` | resolved recipient count |
| `sent_count` / `failed_count` | send tally |
| `created_at` | timestamptz default now() |

RLS via the permission matrix helpers (`user_has_permission` /
`user_is_sys_admin`) — readable/insertable by sys_admin only; server writes use
the service-role client. Gives a record of what was sent to whom and when, and a
foundation for a "Sent history" view later.

## 7. Error handling

- Missing `RESEND_API_KEY` / service key → 500 with a clear message (no partial
  send).
- Non-sys_admin → 403.
- Empty recipient set (filters match no one) → 400 / disabled Send with "0
  recipients".
- Partial failures don't fail the whole request — they're tallied and surfaced
  ("Sent 141 · 2 failed") and recorded in the audit row.
- Send button disabled while in flight to prevent double-blasts.

## 8. Testing

- **Recipient resolution:** active-only, base/role filters, dedupe, invalid/empty
  emails dropped.
- **Chunking:** N recipients → correct batch grouping (e.g. 250 → 100/100/50).
- **Permission:** non-sys_admin caller → 403; button hidden for non-sys_admin.
- **Sender allowlist:** an unknown / off-domain from → 400; a known from is used
  as `from` and `reply-to`.
- **Safe-subset renderer — deliverability guard (locks the rule):** for
  adversarial input (a Markdown link `[x](http://evil)`, a raw `<a href>`, a raw
  `<img>`, a bare autolink `http://foo`), `renderSafeMarkdown` output contains
  **no `<a`** and **no `<img>`**, only allowlisted tags, and the URLs survive as
  escaped plain text.
- **Safe-subset renderer — formatting:** headers, bullet/numbered lists,
  bold/italic, and paragraph breaks render to the correct allowlisted tags.
- **Test send:** targets only the caller; writes no audit row.

## 9. Out of scope (YAGNI)

- In-app broadcasts (the app already has a "What's New" gate for in-app notices).
- Attachments (PDF etc.), scheduling/send-later, and a full "Sent history" UI —
  all easy follow-ons on top of the `email_broadcasts` table if wanted.

## 10. Success criteria

- A sys_admin can compose subject + message in `/users`, preview it,
  send a test to themselves, see a live recipient count with optional base/role
  filters, confirm, and send.
- Each recipient gets an individual, personalized, **branded email with
  Markdown-rendered formatting** (headers/bullets/bold), **no embedded external
  links**, and a `text/plain` fallback, from a **selected, validated
  `@glidepathops.com` sender** (default `info@`).
- The recipient list is never exposed across recipients.
- A row is written to `email_broadcasts` with the tally; partial failures are
  surfaced, not swallowed.
- Non-sys_admin cannot see or invoke the feature.
