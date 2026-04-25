# Offline Write Queue — Test Plan

Manual run-through for the offline write queue, pending photos, and inspector UI shipped in commits `14e23fc` … `4a3a41c` (2026-04-25). Companion to `Offline_Write_Queue_Spec.md`.

Total time: ~30–45 minutes if you do every phase.

---

## Setup

- DevTools open (F12)
- **Network** tab — that's where you flip throttle (No throttling / Slow 3G / Offline)
- **Application** tab → **Storage → IndexedDB** — for inspecting actual queue state when something looks wrong. Two databases:
  - `glidepath-write-queue` → `queue` store (queued Supabase writes)
  - `glidepath-pending-photos` → `photos` store (photo blobs awaiting manual upload)

---

## Phase 1 — online happy path (regression check, ~5 min)

Confirm we haven't broken anything for the normal case.

- [ ] File an airfield inspection while online → no pills appear, normal flow
- [ ] Submit a FOD check → normal
- [ ] File an ACSI inspection → normal
- [ ] Sign a daily review slot → normal

If any of these acts weird, stop and report — that's a regression.

---

## Phase 2 — transient mid-call drop (the queue catches it)

This is the headline feature. Sequence is the same for each surface:

1. **Throttle to Slow 3G first** — so the request takes long enough to act on
2. Tap the submit action (File / Submit / Sign)
3. Watch the Network panel — when you see the Supabase request fire, **switch the throttle to Offline**
4. Expect:
   - Toast: "X queued — will sync when reconnected"
   - Amber `● 1 QUEUED` pill in header
5. Switch throttle back to "No throttling"
6. Within ~3 seconds the QUEUED pill should disappear
7. The originating page's list should auto-refresh and show the new state (completed / signed / etc.) without a manual refresh

Run this for:

- [ ] **Inspection File** (UPDATE) — expect the longer toast: *"Inspection queued — will file automatically when the network returns. Photos, NAVAID outages, and activity log entries will need to be re-applied after sync."* That's intentional — those side effects aren't queue-wrapped.
- [ ] **Check Submit** (CREATE) — expect: *"Check queued — will save automatically when the network returns. Re-add any photos or discrepancies once reconnected."*
- [ ] **ACSI File** (UPDATE) — expect: *"ACSI inspection queued — will file automatically when the network returns."* Page navigates to detail view.
- [ ] **Daily Review Sign** (UPDATE) — expect: *"X slot sign queued — will commit when the network returns."*

---

## Phase 3 — full offline (the gate holds)

For inspections + checks specifically:

1. Start an inspection or check (online, normally)
2. Switch throttle to **Offline**
3. Tap File / Submit
4. Expect a hard-fail toast: *"You're offline. Your inspection is saved as a draft — re-open and tap File when your connection is restored."* (or similar for checks)
5. **Nothing should queue.** No QUEUED pill.

This confirms we didn't accidentally allow fully-offline starts that would create partial state.

- [ ] Inspection: hard-fail toast, no queue activity
- [ ] Check: hard-fail toast, no queue activity

ACSI and daily review do **not** have this gate (no FK fan-out from their call sites), so for those, fully offline → goes straight to the queue. Test that path too:

- [ ] ACSI File while fully offline → queues
- [ ] Daily review sign while fully offline → queues

---

## Phase 4 — inspector (~5 min)

You should have at least one item visible from Phase 2 if you're quick. Or seed manually by submitting offline.

- [ ] **Click the QUEUED pill** — inspector opens
- [ ] Title shows "Pending sync (1 write)" or similar
- [ ] One item shows: type label, age, "Pending" badge
- [ ] Two buttons visible: "Retry now" + "Discard"

**Retry test:**

- [ ] Click **Retry now** while still offline → toast "Retry queued — will try again on next reconnect"
- [ ] Restore network → item commits, inspector empties

**Discard test:**

- [ ] Queue something the same way
- [ ] Click **Discard** in inspector → confirm dialog appears
- [ ] Click OK → item disappears

**NEEDS REVIEW test (harder to trigger naturally):**

The simplest way to force a `failed` item is to break RLS — switch your user role temporarily to one that can't write to the table you're submitting on, or in Supabase Studio, set up a CHECK constraint violation. Once it lands as `failed`, you should see the red `● 1 NEEDS REVIEW` pill alongside QUEUED.

- [ ] Trigger a failed item
- [ ] Red NEEDS REVIEW pill appears
- [ ] Click either pill → inspector shows the failed item with the error message
- [ ] Failed item shows red "FAILED" badge

---

## Phase 5 — daily review conflict (the trickiest)

You need the same slot to appear pre-signed when the queue drains.

**Easiest setup:** open Supabase Studio → `daily_reviews` table → find your row → manually set:
- `day_amsl_signed_at = '2026-04-25T00:00:00Z'` (or whatever Zulu)
- `day_amsl_signed_by = '<some other user uuid>'`

Then in the app:

1. Open the daily review sign modal
2. Pick the day_amsl slot (you may need to unset `signed_at` first to let the picker open it; reset after)
3. Throttle to Offline
4. Sign → queues
5. **Re-set signed_at on the row** in Supabase Studio so the conflict triggers
6. Restore network → drain runs

- [ ] Item appears in inspector with **purple CONFLICT badge**
- [ ] Error message: *"DAY_AMSL slot for YYYY-MM-DD was already signed at …"*
- [ ] Discard from inspector

**Online conflict path (easier to verify):**

1. Manually set `day_amsl_signed_at` via Studio
2. Try to sign that slot online from the modal

- [ ] Error toast with the conflict message — no queue activity

---

## Phase 6 — photos (the middle-option flow)

1. Start an inspection (online — needs a `dbRowId`, which is created at "Start")
2. Throttle to **Offline**
3. Tap an item to take a photo, attach a photo from picker

Expected:

- [ ] Photo shows in preview (component state)
- [ ] Toast: *"Photo saved locally — upload it from the queue pill when reconnected."*
- [ ] Cyan `● 1 PHOTO WAITING` pill appears in header
- [ ] Application → IndexedDB → `glidepath-pending-photos` → `photos` shows one row with the Blob

**Survive-reload test:**

- [ ] Close the tab entirely, reopen → photo still in IDB, pill still showing

**Manual upload:**

1. Restore network
2. Click PHOTOS WAITING pill → inspector opens

- [ ] "Photos waiting" section visible with one row
- [ ] Row shows: thumbnail, filename, age, KB, inspection item id, disc index (if applicable)
- [ ] Click **Upload** on one row → toast "Photo uploaded.", row disappears

**Upload All test:**

- [ ] Save 3+ photos offline
- [ ] Restore network, open inspector
- [ ] Click **Upload all** → reports per-batch summary

**Discrepancy photo path:**

- [ ] Same flow but on a discrepancy entry within an inspection item
- [ ] Mixed-result batch toast format: *"3 of 5 uploaded; 2 saved locally for later upload"*

**Discard test:**

- [ ] Click Discard on a photo row → confirm dialog → row disappears, IDB row gone

---

## What's *not* automatically tested (worth eyeballs)

- **iOS PWA behavior with Blob in IDB.** Not verified on a real iPad. iOS Safari has had multi-year-old quirks here. Worth one real-device pass before betting field deployments on it.
- **Quota exhaustion.** If a user queues a lot of photos and IDB hits quota, `put()` fails silently. Hard to reproduce in DevTools but worth knowing.
- **Auth expiry overnight.** A queued write that sits past Supabase's refresh-token TTL will fail on drain with an auth error. Should land as `failed` and surface in NEEDS REVIEW. Hard to test without time-shifting.

---

## Quick "is the queue even installed" sanity

In the DevTools console:

```js
window.dispatchEvent(new CustomEvent('glidepath:write-committed', { detail: { type: 'inspection_file', id: 'test', optimisticEntityId: null } }))
```

That should trigger the inspections page to re-fetch. Good smoke for the wiring.

---

## Reporting issues

If something doesn't behave per this doc:

1. Note which phase + step number
2. Screenshot the IDB state if relevant: Application → IndexedDB → expand the row contents
3. Check the browser console for errors
4. Send the above. I can usually point at the cause from the IDB snapshot alone.
