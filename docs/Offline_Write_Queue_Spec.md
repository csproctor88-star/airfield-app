# Offline Write Queue — Design Spec

**Status:** Not started. Captured here so the next person to pick this up has a complete brief.
**Owner:** TBD
**Effort estimate:** 2–3 weeks one engineer; ~50 tests; ~1 week of careful field testing.

---

## Problem

Glidepath is a PWA with a service worker. The shell loads offline, drafts auto-save to `localStorage`, and map tiles cache. But every Supabase write — File Inspection, File Check, Submit Discrepancy, Save Daily Review, photo upload, etc. — is mapped to `NetworkOnly` in `next.config.js:11`. When the user is offline:

1. The write call throws.
2. The draft survives in `localStorage`, but the **intent** ("I want to file this") doesn't.
3. When connectivity returns, **nothing auto-syncs.** The user must re-open the form and tap File again.

Symptom report from 2026-04-25: AFM completed an inspection without internet, tapped File, the action failed, and reconnecting did not finish the submission.

Today's mitigation (also shipped 2026-04-25):
- Header shows an **OFFLINE** pill when `navigator.onLine === false`.
- Filing an inspection while offline shows a clear toast pointing the user to the "re-open and re-file when connected" workflow instead of letting them assume it succeeded.

This spec describes the real fix.

---

## Scope

### In scope
- All 16 form-submit code paths (inspection file, check file, ACSI submit, discrepancy create/update, NOTAM create, waiver create/update, daily review sign, etc.).
- Photo uploads (storage writes).
- Background sync that drains the queue on reconnect.
- Conflict detection: server row mutated by another user since the queued write was captured.
- A "pending writes" indicator in the UI surfacing queue depth.

### Out of scope (deferred or rejected)
- True multi-user offline collaboration (operational transforms / CRDTs). Not needed — concurrent edits to the same record are already rare.
- Offline reads of records the user hasn't viewed before. The shell loads, but pages that fetch fresh data on mount will fail. Solving this requires a full IndexedDB read cache, which is a separate (larger) project.
- Anything involving server-side jobs (NOTAM sync, etc.). Those run on Vercel and are unaffected.

---

## Architecture

```
User tap (File / Save / Submit)
        ↓
  Optimistic UI update — show "queued" pill on the row
        ↓
   IndexedDB queue table  ← persists across reloads / app restarts
        ↓
  Drain worker
   ├── Listens to navigator online events
   ├── Listens to BackgroundSync API events (Chrome/Edge/Android)
   └── Triggers on app foreground (visibilitychange)
        ↓
  For each queued write:
   ├── Re-execute the captured Supabase call
   ├── On success: remove from queue, update UI
   └── On conflict (412/409): pause, surface UI to resolve
```

### Queue entry shape

```ts
interface QueuedWrite {
  id: string                    // uuid v4, generated client-side
  type:                         // discriminated union — drives the dispatcher
    | 'inspection_file'
    | 'check_file'
    | 'acsi_submit'
    | 'discrepancy_create'
    | 'discrepancy_update'
    | 'notam_create'
    | 'waiver_create'
    | 'waiver_update'
    | 'daily_review_sign'
    | 'photo_upload'
    | 'airfield_status_update'
    // (...one per write surface)
  payload: unknown              // type-specific, validated by Zod schema per type
  createdAt: string             // ISO
  attempts: number              // for backoff
  lastAttemptAt: string | null
  lastError: string | null
  baseId: string                // for filtering / display
  userId: string                // for filtering on multi-user devices
  // Optimistic state only:
  optimisticEntityId?: string   // local-only id for the row we showed in UI
  conflictAt?: string           // set if server returned 412/409
}
```

### Storage location
- IndexedDB store name: `glidepath-write-queue`
- One object store with `id` as keypath
- Indices on `userId`, `createdAt`, `type`

`localStorage` is the wrong tool here — 5 MB cap and synchronous I/O block the UI.

### Replay / dispatch

A single function `enqueueWrite()` is the only entry point. Per-feature wrappers stay simple:

```ts
// Before:
const { error } = await fileInspection({...})

// After:
const result = await enqueueOrExecute('inspection_file', {...})
// result is one of: { status: 'committed', data } | { status: 'queued', queueId }
```

When online, `enqueueOrExecute` runs immediately and returns `committed`. When offline, it appends to the queue and returns `queued`.

A `WriteQueueDrainer` singleton (`lib/sync/write-queue.ts`) does:

1. On `online` event → drain.
2. On `BackgroundSync` event (`'glidepath-sync'`) → drain.
3. On `visibilitychange` to visible → drain.
4. Drain = read all queued items, execute serially in `createdAt` order, retry with exponential backoff on transient failures (3 attempts max, capped at 5 minutes).

### Background Sync

Workbox supports the [Background Sync API](https://developer.mozilla.org/en-US/docs/Web/API/Background_Sync_API) where supported (Chrome, Edge, Android). The service worker can replay queued requests even when the app tab is closed. iOS Safari does not support BackgroundSync — fallback is the next-foreground drain.

Add to `next.config.js`:

```js
{
  urlPattern: /\.supabase\.co\/.*/,
  handler: 'NetworkOnly',
  options: {
    backgroundSync: {
      name: 'glidepath-sync',
      options: { maxRetentionTime: 24 * 60 } // 24 hours
    }
  }
}
```

This buys *opportunistic* sync. The IndexedDB queue is the *authoritative* layer.

---

## Conflict resolution

When draining, a queued write may collide with the current server state — another user filed the same inspection, marked the same discrepancy resolved, etc.

### Strategy by write type

| Write | Conflict behavior |
|---|---|
| Inspection file | Last-write-wins. The form is single-user (only the inspector who started it can finish it). Conflict surface: show a warning if `filed_at` is already set; offer to overwrite or discard. |
| Check file | Same as inspection. |
| Discrepancy create | No conflict possible (creates a new row). |
| Discrepancy update | Compare `updated_at`. If server is newer, surface a "this discrepancy was edited by someone else — review and re-apply" modal. |
| Daily review sign | Strict: refuse to overwrite an existing slot signature. Show "this slot was already signed by X at Y; your queued sign was not applied." |
| Photo upload | Always proceeds (storage append, no conflict). |
| Airfield status update | Last-write-wins (status is naturally a most-recent-value field). |

A small `<ConflictResolutionModal>` component handles the user-facing flow when manual resolution is needed.

---

## UI surfaces

### "Pending writes" indicator (header)

Next to the existing OFFLINE pill, show a "● 3 queued" pill when the queue depth > 0. Clicking it opens a side sheet listing each queued write with its type, age, and a "force retry" button.

### Optimistic UI on the originating row

Form submits show a small "queued" tag with a clock icon next to the row in lists. Once committed, the tag disappears.

### Failure surfacing

If a queued write hits its retry cap or returns a non-retriable error (400, 403), a persistent toast + a banner on the page guides the user to the queue inspector.

---

## Test plan

A non-trivial system. Tests must cover:

1. **Unit: queue persistence** — write, reload page, queue still present.
2. **Unit: dispatcher** — each `type` correctly routes to its handler.
3. **Unit: backoff** — retry timing, max-attempts enforcement.
4. **Integration: online drain** — start offline, queue 5 writes, come online, all drain in `createdAt` order.
5. **Integration: foreground drain** — same but triggered by `visibilitychange`.
6. **Integration: conflict** — simulate a server-side row mutation, queue, drain, modal appears.
7. **Field test: real iOS PWA** — flight mode → file inspection → reconnect → confirm sync.
8. **Field test: closed tab** — Background Sync path on Chrome/Android.

Target: ~50 tests added.

---

## Migration / rollout

The queue can ship dark — wrap one feature first (inspections), validate in production for a week, then progressively wrap the others. Each feature wrap is one PR.

Order suggested:
1. Inspections (highest user value)
2. Checks
3. Discrepancies (create + update)
4. ACSI
5. Daily reviews
6. Photo uploads
7. Everything else

---

## Open questions

- Do we expose the queue in Settings as an admin-visible debug surface?
- How long do we retain failed writes before garbage-collecting? Suggest 7 days.
- Multi-device: if the same user has two iPads with queued writes for the same record, the second device's drain may collide with the first's. Acceptable since this is rare; surface as a conflict and let the user resolve.

---

## Out of band: what we shipped 2026-04-25

- Header now displays a red **OFFLINE** pill when `navigator.onLine === false`.
- `useOnlineStatus()` hook in `components/layout/header.tsx`.
- Inspection File button now hard-fails with a clear toast when offline, instead of letting the user wait for a silent network error.

These are mitigations, not the queue. They make the failure mode visible; the queue is what makes it disappear.
