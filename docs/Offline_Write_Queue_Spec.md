# Offline Write Queue — Design Spec

**Status:** Foundation + 4 wraps in production as of 2026-04-25. Inspector UI shipped. ~3 wraps still to go (photos, discrepancies, slot-#7 small ones). Original design doc preserved below; current state and lessons in the section that follows.

---

## Implementation status (2026-04-25)

### Shipped

**Foundation** — `lib/sync/`
- `types.ts` — `WriteType` discriminated union, `QueuedWrite`, `WriteHandler`, `EnqueueResult`, `NonRetriableError`, `ConflictError`.
- `backoff.ts` — exponential 1s → 16s, capped at 5 min, max 5 attempts.
- `queue-storage.ts` — `IndexedDBStorage` (own DB `glidepath-write-queue`, separate from the AOMS PDF cache) and `MemoryStorage` (test harness, no `fake-indexeddb` dep needed).
- `write-queue.ts` — `WriteQueue` class: handler registry, single-flight `drain()`, oldest-first execution, browser event wiring (`online` + `visibilitychange`), idempotent `attach()`. Dispatches `glidepath:write-committed` window events on every successful drain commit so feature pages can re-fetch.
- `handlers.ts` — registers handlers per WriteType. Adapts each Supabase CRUD `{ data, error }` to throw-on-failure with NonRetriable / Conflict classification.

**Wraps** — 4 surfaces routed through `enqueueOrExecute`:
| WriteType | Mutation | Wrap shape |
|---|---|---|
| `inspection_file` | UPDATE existing row | optimistic id kept; queued path bails before downstream photo / NAVAID / activity log calls |
| `check_file` | CREATE new row | queued path bails (no optimistic id possible for inserts) |
| `acsi_submit` | UPDATE existing row | cleanest wrap — no FK-dependent side effects in the call site |
| `daily_review_sign` | UPDATE existing row | first real `ConflictError` user — handler fetches the row and refuses to overwrite an already-signed slot |

**UI**
- `WriteQueueProvider` mounts in the authed layout, registers handlers, attaches listeners, and drains on mount.
- Header `useQueueDepth()` hook + amber `● N QUEUED` pill (clickable) next to the existing OFFLINE pill.
- `components/sync/queue-inspector.tsx` modal — opens from the pill, lists items with type / age / status / attempts / last error, per-row Retry and Discard buttons, conflict items show in purple.

**Drain-event wiring** (so realtime UPDATE blind-spot doesn't strand drained rows):
- `/inspections` listens for `inspection_file` commits → `loadHistory()`
- `/acsi` and `/acsi/[id]` listen for `acsi_submit` commits → re-fetch
- `/checks` listens for `check_file` commits → re-fetch recent
- `/daily-reviews` listens for `daily_review_sign` commits → re-fetch

**Tests:** 218 in CI. Foundation: backoff math, MemoryStorage CRUD/isolation, drain order & retry / failed / conflict transitions, single-flight, dispatch-event behavior, handler error classification per WriteType.

### Not shipped yet

| Slot | Surface | Status / blocker |
|---|---|---|
| #3 | discrepancy create + update | 4 update sites in `components/discrepancies/modals.tsx` are tangled with NAVAID feature status changes + outage events. 4 inline `createDiscrepancy` calls inside other flows (inspection, check, infrastructure) all have FK-dependent photo/NAVAID downstream — wrapping the create alone leaves them broken. Needs slot #6 (photos) first to do correctly. |
| #6 | photo uploads | Photos are the architectural unlock. IDB stores Blobs natively via structured-clone, so no foundation change is strictly needed — `payload: P` can hold a `File`. Open question: how to handle photos that reference a not-yet-created entity (e.g., a check that's still queued). Likely: pre-allocate a UUID client-side, persist with both the create and the photo, drainer rewrites references on commit. Not started. |
| #7 | NOTAM, waiver, airfield_status | NOTAM new is a stub today (no DB write — read-only feed). Waiver create / update are wrappable but have downstream `upsertWaiverCriteria` and attachment uploads that aren't queued. Airfield status updates fire from many dashboard handlers (BWC / RSC / RCR / runway / ARFF) — wrap is wide-touch, low individual value, not started. |

### The hard-offline gate stays put for now

Inspections and checks both keep a "navigator.onLine === false → toast + return" gate at the top of `handleComplete`. Without it, the queued path would let the user proceed but downstream code (discrepancy creates, NAVAID inop, photo uploads, activity logging) would all fire offline and either fail silently or throw partial-state errors at the user.

The wraps shipped today catch transient mid-call drops, not full-offline starts. Lifting the gate requires slot #3 + slot #6 to be fully wrapped.

ACSI does not have a gate (no FK-dependent side effects in the call site). Daily review sign also does not have a gate.

---

## Lessons learned during the rollout

### Realtime fires on INSERT, not UPDATE

`airfield_checks` and `inspections` realtime channels are configured INSERT-only. A queued UPDATE landing via the drainer would otherwise stay invisible until the user refreshes. **Solution:** WriteQueue dispatches `glidepath:write-committed` on every commit; pages add a tiny `useEffect` listener and call their existing loader.

### Queued path must bail; it can't fall through

First version of the inspection wrap let the queued branch fall through into the rest of `handleComplete`. Result: the page ran offline-failing photo uploads + NAVAID inop + activity log, then painted a "completed & filed" success toast over a still-in-progress inspection. **Solution:** queued branches do their local cleanup (drafts, blob URLs, navigation) and `return`. The drain handler re-runs only the wrapped Supabase call — not the inline side effects. That's a known limitation called out in the toast text.

### CREATE wraps need pre-allocated IDs to chain

For `check_file` (CREATE) the queued path can't return an `id` because the row doesn't exist yet. Photos / discrepancies created in the same flow have nothing to FK against. The wrap therefore bails on queued. Slot #6 (photos) will need a "client-side UUID, write it on both rows, drainer rewrites references" pattern to chain.

### ConflictError is rare but real

`daily_review_sign` is the first surface where ConflictError fires for real — the handler fetches the row first and refuses to overwrite an already-signed slot. The inspector renders these as a distinct purple "CONFLICT" badge; the user resolves with Discard. No automatic conflict-resolution modal yet — the per-row error message and Discard button are sufficient for now.

### Storing Files in IndexedDB just works

We pre-emptively expected to need `fake-indexeddb` and a Blob storage extension. Neither is required: IDB's structured-clone storage handles `Blob` and `File` natively, and `MemoryStorage.put` uses `structuredClone()` which also handles Blobs. The slot #6 work is mostly about ID re-mapping, not storage.

### `'use client'` server-import trap

Don't import `lib/sync/write-queue.ts` from any `app/api/*/route.ts`, `app/**/route.ts`, or `middleware.ts`. The `getDefaultStorage()` path touches `indexedDB`, which doesn't exist in Node. So far we've kept all queue access on the client side. If a server-side enqueue ever becomes desirable, the storage backend needs to be selected up-front, not defaulted.

---

# Original design doc (preserved)

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
