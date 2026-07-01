# Glidepath Codebase Health Audit

**Date:** 2026-05-28
**Method:** Multi-agent audit — 9 specialist agents (one per health dimension) read the actual source code and gathered evidence; every medium-or-higher finding was then handed to a separate agent whose job was to *try to disprove it*. 27 agents total, ~1.5M tokens, ~12 minutes. 36 findings survived verification.
**Branch / HEAD at audit time:** `main` @ `282e3af`

> **How to read this:** Each finding has a *severity* (how much it matters), an *effort* (how big the fix is), and a *verification verdict*. "Confirmed" means the skeptic agent read the code and the problem is genuinely there. "Overstated" means the problem is real but smaller than first claimed — the severity here is already corrected down. Anything the skeptic *refuted* was thrown out and isn't listed.

---

## Overall grade: **B** (healthy, with a few sharp edges)

Your app is fundamentally well-built. The hard things most projects get wrong are right here: every user and every data request is protected by two independent security layers, the code compiles cleanly, the project follows its own naming/styling rules with unusual discipline, and the most error-prone logic (who-can-do-what permissions) is thoroughly tested. Nothing is on fire, and nothing corrupts existing data.

The issues worth your attention fall into three buckets: **one real security gap in the sign-up flow**, **a few places that can silently fail to save**, and **two safety-critical math engines that are almost entirely untested**. None require a rebuild — they're cleanups on a solid foundation.

### Grades by dimension

| Dimension | Grade | One-line takeaway |
|---|---|---|
| Architecture & Structure | B | Coherent and well-layered; a couple of huge files are the main drag. |
| Type Safety | B | Strictest setting, passes clean. Some "trust me" overrides in newer modules. |
| Security & Access Control | B | Strong foundations; one genuine sign-up loophole to close. |
| Data Integrity & Error Handling | B | Core modules are careful; the parking map and outage report can fail silently. |
| Test Coverage & Quality | C | Good tests, but clustered on easy parts; the riskiest math is untested. |
| Performance & Resource Use | A* | Healthy; two background timers should pause when the tab is hidden. |
| Dependencies & Build Health | C | Core is current; a scan flags issues, mostly build-only noise. |
| Duplication & Dead Code | B | ~4,500 lines of leftover map code to delete; otherwise tidy. |
| Consistency & Conventions | A | Exceptionally disciplined. Mostly stale-docs nitpicks. |

\* *The Performance agent's summary field glitched (returned placeholder text); the grade and its single finding are reported as-is.*

---

## Fix this first: the sign-up role loophole

**Severity: HIGH · Effort: quick · Verdict: CONFIRMED (and the skeptic agent made it *worse*, not better)**

**What it is:** When someone creates their own account on the login page, the form sends a "role" to the server. The visible form hides the powerful roles (system admin, base admin), but **the server doesn't re-check that** — it writes whatever role it receives onto the new account. Using ordinary browser developer tools, a determined person can submit `role = sys_admin` for their own brand-new account.

**Why it matters:** New sign-ups are created in a "pending" state, so at first glance the danger looks limited to an admin approving the account without noticing the inflated role. **But the verification agent found the "pending" gate is not actually a security wall.** The pending check exists only in the app's screen logic; the database's own security rules grant access based on *role*, not on pending-vs-approved status. That means a person who self-signs up as `sys_admin` could log in directly against the database's public API (bypassing your app's screens entirely) and receive full system-administrator access across **every base** — without waiting for anyone to approve them.

For a U.S. Air Force compliance tool, an unauthorized system administrator is a serious problem. This is the single highest-risk item in the whole audit, and the fix is small.

**The fix:** In `app/api/signup-email/route.ts`, reject (or silently downgrade to `read_only`) any role that isn't in the permitted self-service set, *before* creating the account. This mirrors protection you already have on the admin-invite flow. Worth pairing with: make the database's permission helpers respect the `pending` status too, so the status gate becomes a real boundary.

**Locations:** `app/api/signup-email/route.ts:46-98`; trigger in `supabase/migrations/2026061300_profile_unit_office_symbol.sql:43,77`.

---

## Confirmed issues, by priority

These all survived the skeptic agent. Severities shown are the *verified* (corrected) ones.

### 1. Sign-up role loophole — HIGH · quick
Covered above.

### 2. NAVAID / lighting outage compliance engine is untested — HIGH · moderate
**What it is:** The 460-line file that decides whether broken airfield lights have crossed Air Force regulatory limits (and whether a NOTAM and engineering notification are required) has tests for only its trivial 4-line color-picker. The functions doing the real regulatory math — counting outages, percentages, "too many in a row," the 3-of-5 bar-out rule, the green/yellow/red/black decision — have **zero tests**.
**Why it matters:** If someone changes this math and gets it subtly wrong (a flipped `>` sign, an off-by-one), the app keeps running and shows confident, official-looking "within limits / GREEN" results that are *wrong*. An airfield manager could be told an outage is compliant when it actually requires action. Nothing crashes; the wrong answer just looks right. For a compliance tool, that's the worst failure mode.
**The fix:** Add a test file feeding hand-built scenarios to the math functions (at threshold vs. one-over, the bar-out rule, adjacent/consecutive detection). These are pure calculations with no database, so tests are fast to write.
**Location:** `lib/outage-rules.ts` (460 lines) vs. `tests/outage-tier.test.ts`.

### 3. Aircraft parking clearance geometry is untested — HIGH · moderate
**What it is:** The module that decides whether parked aircraft are spaced safely (wingtip clearance, taxilane envelopes, obstacle distances) — 25 functions — has tests for only 3 trivial lookup helpers. The actual collision-detection geometry is untested.
**Why it matters:** Same failure mode as the outage engine. A regression could tell an operator two aircraft are safely spaced when their wingtips actually overlap — shown as a clean green result they'd trust. A wrong "clear" could contribute to a real ground collision.
**The fix:** Test the `check*` functions with simple two-aircraft fixtures (one clearly clear, one clearly overlapping, one exactly at the limit). Pure geometry, so it tests cleanly.
**Location:** `lib/calculations/parking-clearance.ts` (1,058 lines) vs. `tests/parking-clearance.test.ts`.

### 4. Parking map drag can silently fail to save — MEDIUM (downgraded from high) · moderate
**What it is:** When a user drags an aircraft/obstacle to a new spot on a parking plan, the app moves it on screen and tries to save — but ignores whether the save succeeded. The underlying save functions also throw away the real error.
**Why it matters:** A user could reposition aircraft, see them sitting where they dropped them, and believe it's saved — when the save actually failed (dropped connection, permission issue). On the next reload the aircraft snap back and the work is gone, with no warning. The skeptic downgraded this to medium because it's *recoverable* (the database simply keeps the old position; a reload shows the truth) — but it's still exactly the "I thought I saved it" worry.
**The fix:** On a failed save, show an error toast and snap the marker back to its previous position.
**Location:** `app/(app)/parking/page.tsx:1849-1870`; `lib/supabase/parking.ts:354-401`.

### 5. Outage report shows green "success" even when its work order fails — MEDIUM · quick
**What it is:** Reporting a NAVAID/lighting outage auto-creates a tracked work order (discrepancy). If that creation fails, the app still flashes a green "Outage reported" message.
**Why it matters:** Auto-creating the work order is the whole point of the feature. If it silently fails but the user is told it worked, the airfield is in an unsafe state with no work order tracking it and nobody aware.
**The fix:** Check the result; on failure show an error/warning instead of a success message.
**Location:** `app/(app)/infrastructure/page.tsx:1264-1295`.

### 6. ~4,500 lines of orphaned Mapbox map code — MEDIUM · quick
**What it is:** When maps migrated from Mapbox to Google Maps, brand-new "-google" versions were written alongside the old ones, but the nine old files were never deleted. No running page uses them.
**Why it matters:** They don't ship to users or slow anything down — but they're a trap. A developer fixing a map bug faces two near-identical files and may fix the dead one. This is the single largest chunk of dead code in the project.
**The fix:** Delete the nine files in one commit, then run `tsc --noEmit` and `npm run build` to confirm nothing breaks (it won't — no live importers). Keep the wildlife heatmap, which legitimately still uses Mapbox. ~15 minutes.
**Location:** seven `*-map*.tsx` components + `components/taxiway-editor.tsx` + `hooks/use-map-ruler.tsx`.

### 7. Cross-base data isolation (RLS) is not tested by automation — MEDIUM (downgraded from... confirmed gap) · large
**What it is:** Row-Level Security is the database rule that stops a user at Base A from reading Base B's records. The only test for it runs two checks that confirm a *logged-out* stranger can't read data — and even those only run if live database credentials happen to be present locally (they skip in normal runs). The case that matters most — a user logged into one base reaching another base's data — is never tested.
**Why it matters:** Your app-code permission checks are well-tested, but RLS is the last line of defense and can't be bypassed. These policies are hand-written SQL that changes often; if a future migration accidentally loosened one, nothing would catch it. The skeptic downgraded this to medium because it's a *coverage gap*, not a proven hole — the policies do exist and are enforced in production.
**The fix:** Stand up a seeded test database with two bases and users of different roles; assert each can reach their own base and gets denied on the other. Larger effort.
**Location:** `tests/rls-smoke.test.ts`, `tests/permission-rpcs.test.ts`.

### 8. Base-setup wizard is one ~6,000-line file — MEDIUM · large
**What it is:** The new-base configuration screen is a single 6,000-line file (a typical screen is a few hundred). It's internally split into ~16 section editors, but they all live in one file. (Already in your known tech debt — confirmed and slightly larger than the docs say.)
**Why it matters:** Slow and risky to edit; a change in one section can break another. Because the sections are already separated internally, splitting them into files is mostly low-risk cut-and-paste.
**The fix:** Extract each section into `components/base-setup/`, a few per session.
**Location:** `app/(app)/base-config/setup/page.tsx` (6,039 lines).

### 9. Two background timers don't pause when the tab is hidden — LOW · quick
**What it is:** A 30-second status refresh and a 5-minute header call keep running even when nobody's looking at the tab. The 5-minute one hits the login server — the same category that once strained your Supabase quota.
**Why it matters:** Across many users and tabs, this is avoidable cost and load. No data or security risk.
**The fix:** Add the visibility guard you already use on the sidebar; switch the header to the lighter `getSession`.
**Location:** `lib/dashboard-context.tsx:455-460`; `components/layout/header.tsx:177-210`.

---

## Lower-priority items (verified, low/info)

- **Stale rulebook (CLAUDE.md):** lists 12 PDF generators (there are 20), describes an `app/(public)` folder that doesn't exist, points to a moved file, omits several live sections (aep, base-config, sms, training…), and contradicts its own naming example. Quick fix; bundle with the v2.34.0 prep. *(Confirmed across multiple agents.)*
- **Kiosk token readable by any logged-in user (LOW, downgraded):** any authenticated user can read every base's secret kiosk token and open another base's read-only status display. Bounded (view-only, needs an account) but defeats the token's purpose.
- **Legacy `airfield-status` API endpoint writes with no permission check (LOW):** an older endpoint lets any logged-in user change the status board, bypassing normal rules. The live app doesn't appear to use it. Add a check or delete it.
- **`as any` count is ~167 (plus ~155 `as unknown as`), not the ~124 you track (LOW):** measurement accuracy, not a bug. Worth splitting into "harmless browser glue" vs. "database reads worth reviewing."
- **Newer modules (SMS, Inspections, AEP) read DB data through unchecked casts (LOW, downgraded — earlier claims were partly string-search artifacts):** real but mild; the tables do exist in the schema and the app types are generally stricter.
- **Dependency scan flags 29 issues, mostly build-only noise (LOW):** the headline ones (`xlsx`, `jspdf`) were downgraded — the vulnerable spreadsheet parser turned out to be **dead code** (your real import uses the safer ExcelJS), and jsPDF's dangerous functions aren't called. Run the safe `npm audit fix` on a maintenance pass; plan Next.js 15 evaluation eventually.
- **Unused code:** a fully-built but never-opened "Work Order" dialog (~95 lines), two unused SMS report/export builders, and a long tail of small unused exports. Clean opportunistically.
- **Nine component files use PascalCase names** against the kebab-case standard; one type-only relative import. Cosmetic.
- **Rate limiter "fails open"** on a database error (INFO): intentional and reasonable, but add alerting so a broken limiter is noticed.
- **'GLIDEPATH' trademark (INFO):** CDW holds a live Class 42 (SaaS) registration — a go-to-market legal risk, not a code issue. Get a clearance opinion before commercial launch.

---

## What the verification layer caught (why you can trust this)

The adversarial second pass meaningfully corrected the first-pass findings — which is the point of running it:

- It **downgraded** the parking-drag, kiosk-token, RLS, type-safety, xlsx, jsPDF, and PDF-test findings from medium/high to their true (lower) severity after reading the surrounding code.
- It caught a **fabricated example**: the architecture agent claimed the parking page bypasses the data layer with "7 direct queries." The skeptic found the parking page has *zero* direct database calls — it's actually a model of correct layering. That false claim was removed.
- It caught **string-search artifacts**: a type-safety claim that the Wildlife and SMS tables were "missing from the schema" was wrong — the agent had searched for the wrong table name.
- It **strengthened** the sign-up finding: it proved the "pending account" mitigation isn't a real security boundary.

Of 36 surviving findings, **8 were confirmed at high/medium**, the rest are low/info.

---

## Suggested sequence

1. **This week (all quick):** sign-up role loophole (#1), outage-report false success (#5), delete the orphaned Mapbox code (#6), refresh CLAUDE.md, pause the background timers (#9). Pair with the pending v2.34.0 bump.
2. **Soon (moderate):** tests for the outage engine (#2) and parking geometry (#3) — your two biggest quality risks; parking-drag save warning (#4); kiosk-token scoping; lock down the legacy status endpoint.
3. **Deliberate / larger:** seeded RLS isolation tests (#7), base-setup file extraction (#8), dependency upgrade pass, Next.js 15 evaluation.
