// ============================================================================
// Glidepath Interactive Codebase Guide — GENERATOR
// ----------------------------------------------------------------------------
// Reads the REAL source files at build time and emits one self-contained,
// offline HTML file at docs/glidepath-guide.html (all CSS + JS inline).
//
//   Regenerate after code changes:   node docs/build-glidepath-guide.mjs
//
// Why a generator and not a hand-written HTML file?
//   * Verbatim guarantee — every code block is read from the real file on
//     each build, never hand-copied, so it cannot drift or be fabricated.
//   * If a code anchor can't be found, the build records it in the in-app
//     "Gaps" panel instead of silently emitting stale code.
//   * This script IS the one-line regeneration command Phase 3 asks for.
//
// The OUTPUT (glidepath-guide.html) has no build step and no runtime deps —
// it opens by double-clicking and works fully offline (except the optional
// AI chat, which the user explicitly enables with their own API key).
// ============================================================================

import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve, extname } from 'node:path'

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dir, '..') // docs/.. == repo root
const OUT = join(__dir, 'glidepath-guide.html')

const gaps = [] // auto-collected; surfaced in the in-app Gaps panel

function guessLang(file) {
  const e = extname(file).toLowerCase()
  if (e === '.ts' || e === '.tsx') return 'typescript'
  if (e === '.js' || e === '.mjs' || e === '.jsx') return 'javascript'
  if (e === '.sql') return 'sql'
  if (e === '.json') return 'json'
  if (e === '.css') return 'css'
  if (e === '.html') return 'html'
  return 'text'
}

// Pull a code block from a real file.
//   spec = { file, from?, to?, caption?, lang?, annotations?, note? }
//   - no from/to    -> whole file (verbatim)
//   - from only     -> from the first occurrence of `from` to EOF
//   - from + to     -> from `from` through the first `to` after it (inclusive)
// Any anchor miss is recorded in `gaps` and falls back to the whole file.
function loadCode(spec) {
  let text = ''
  try {
    text = readFileSync(join(ROOT, spec.file), 'utf8')
  } catch (e) {
    gaps.push({ kind: 'missing-file', file: spec.file, detail: String(e && e.message || e) })
    return {
      caption: spec.caption || spec.file, path: spec.file, lang: spec.lang || guessLang(spec.file),
      code: '/* FILE NOT FOUND AT BUILD TIME: ' + spec.file + ' */', startLine: 1,
      annotations: spec.annotations || [], note: spec.note || '', missing: true, whole: true,
    }
  }
  text = text.replace(/\r\n/g, '\n')
  let code = text
  let startLine = 1
  let whole = true
  if (spec.from) {
    const i = text.indexOf(spec.from)
    if (i < 0) {
      gaps.push({ kind: 'anchor-not-found', file: spec.file, detail: 'start anchor: ' + spec.from.slice(0, 60) })
    } else {
      whole = false
      let end = text.length
      if (spec.to) {
        const j = text.indexOf(spec.to, i + spec.from.length)
        if (j < 0) {
          gaps.push({ kind: 'anchor-not-found', file: spec.file, detail: 'end anchor: ' + spec.to.slice(0, 60) })
          end = text.length
          whole = true // couldn't bound it; show the rest but flag
        } else {
          end = j + spec.to.length
        }
      }
      code = text.slice(i, end)
      startLine = text.slice(0, i).split('\n').length
    }
  }
  return {
    caption: spec.caption || spec.file, path: spec.file, lang: spec.lang || guessLang(spec.file),
    code, startLine, annotations: spec.annotations || [], note: spec.note || '', whole,
  }
}

const C = (spec) => loadCode(spec) // shorthand

// ============================================================================
// CONTENT — authored prose + quizzes + verbatim code pulled from real files.
// Code blocks are read at build time; prose/annotations are mine.
// ============================================================================

const lessons = []
const L = (lesson) => { lessons.push(lesson); return lesson }

// Reusable interactive architecture diagram (clickable layers -> lessons).
const ARCH_SVG = `
<div class="arch" role="group" aria-label="Architecture diagram">
  <div class="arch-layer" data-goto="routing-app-shell">
    <div class="arch-title">1 · Browser / PWA</div>
    <div class="arch-sub">React 18 client components · service worker · IndexedDB offline queue · localStorage</div>
  </div>
  <div class="arch-arrow">▼ &nbsp; HTTP request (cookies) &nbsp; ▲ &nbsp; HTML / JSON / realtime frames</div>
  <div class="arch-layer" data-goto="request-lifecycle-auth">
    <div class="arch-title">2 · Next.js App Router (Vercel)</div>
    <div class="arch-sub">middleware.ts auth gate → pages in app/(app)/* → ~44 lib/supabase CRUD modules → 23 /api route handlers</div>
  </div>
  <div class="arch-arrow">▼ &nbsp; supabase-js (anon JWT) · service-role (server only) &nbsp; ▲</div>
  <div class="arch-layer" data-goto="rpcs-and-functions">
    <div class="arch-title">3 · Server logic: route handlers + Postgres RPCs</div>
    <div class="arch-sub">Node route handlers (admin, email, cron) + ~15 SECURITY DEFINER RPCs — NOT Supabase Edge Functions</div>
  </div>
  <div class="arch-arrow">▼ &nbsp; SQL over the wire &nbsp; ▲ &nbsp; rows + postgres_changes</div>
  <div class="arch-layer" data-goto="data-model-rls">
    <div class="arch-title">4 · Supabase — Postgres · Auth · Realtime · Storage</div>
    <div class="arch-sub">~269 migrations · permission-matrix RLS on every table · Realtime publication · photos bucket</div>
  </div>
  <div class="arch-arrow">▲ &nbsp; realtime UPDATE broadcast re-renders the UI (see the flagship flow)</div>
  <div class="arch-note">Click any layer to jump to its deep-dive. The realtime arrow back to the top is the subject of the flagship walkthrough.</div>
</div>`

// ---------------------------------------------------------------------------
// TRACK: Foundations
// ---------------------------------------------------------------------------

L({
  id: 'start-here', track: 'Foundations', mode: 'course', kind: 'lesson',
  title: 'Start here — how to use this guide',
  summary: 'Orientation, the two modes, and the interactive architecture map.',
  concept: `
<p>This is an interactive, offline reference for the <strong>Glidepath</strong> codebase — the Next.js + Supabase PWA for USAF airfield management. Everything here is generated from your <em>actual</em> source files; each code block shows its real file path and line numbers.</p>
<h4>Two modes (toggle, top-right)</h4>
<ul>
  <li><strong>Course</strong> — an ordered curriculum: Foundations → Subsystems → Modules. Read top-to-bottom to learn the codebase from the skeleton down.</li>
  <li><strong>Reference</strong> — a searchable index of every topic, file, table, and term, so you can jump straight to an answer.</li>
</ul>
<h4>Conventions</h4>
<ul>
  <li>Each section is <strong>Concept → Your code → How it fits → Quiz</strong>.</li>
  <li>Code blocks are <strong>verbatim</strong> from your files. Hover/click annotations explain specific lines.</li>
  <li>The <strong>search box</strong> filters across every section, file, function, and glossary term.</li>
  <li>Your reading progress and quiz scores are saved in this browser (<em>localStorage</em>) — there's a <strong>Reset</strong> button in the header.</li>
</ul>
<h4>The architecture, end to end</h4>
<p>This is the whole system on one screen. Click a layer to open its deep-dive.</p>
${ARCH_SVG}
<p class="callout">A note on accuracy: the original brief mentioned "Edge Functions." Glidepath does <strong>not</strong> use Supabase Edge Functions (Deno). The equivalent server-side layer is <strong>Next.js route handlers</strong> (Node, under <code>app/api/</code>) plus <strong>Postgres <code>SECURITY DEFINER</code> RPCs</strong>. The guide uses the real names throughout — see <a data-goto="rpcs-and-functions" href="#">Server logic: route handlers + RPCs</a>.</p>
`,
  code: [],
  fits: `<p>Everything else in this guide hangs off the four layers above. The single most important idea — how a change in one browser shows up live in another — is the <a data-goto="flow-airfield-status" href="#">flagship request flow</a>. Start there once you've skimmed Foundations.</p>`,
  quiz: [
    { q: 'Which server-side technology does Glidepath actually use for privileged server logic?', choices: ['Supabase Edge Functions (Deno)', 'Next.js route handlers + Postgres SECURITY DEFINER RPCs', 'A separate Express microservice', 'Firebase Cloud Functions'], answer: 1, explain: 'There are no Supabase Edge Functions. Server logic lives in app/api/* route handlers (Node) and in Postgres RPCs marked SECURITY DEFINER.' },
    { q: 'Where is your reading progress and quiz score stored?', choices: ['On a server', 'In a cookie sent to Supabase', 'In this browser’s localStorage', 'It is not stored'], answer: 2, explain: 'Progress is persisted to localStorage in this browser, and can be wiped with the Reset button.' },
  ],
})

L({
  id: 'tech-stack', track: 'Foundations', mode: 'course', kind: 'lesson',
  title: 'The stack & how the pieces earn their place',
  summary: 'Next.js, Supabase, Google Maps, jsPDF, Resend — what each does and why.',
  concept: `
<p>Glidepath is a single Next.js app deployed to Vercel, talking to a single Supabase project (Postgres + Auth + Realtime + Storage). There is no separate backend service — the "backend" is (a) Next.js route handlers running on Vercel and (b) Postgres itself, with Row-Level Security doing the authorization.</p>
<table class="kv">
<tr><th>Layer</th><th>Tech</th><th>Why it's here</th></tr>
<tr><td>Framework</td><td>Next.js 14.2 (App Router)</td><td>File-based routing, server + client components, route handlers for the small amount of privileged server code.</td></tr>
<tr><td>DB / Auth / Realtime</td><td>Supabase (Postgres + RLS)</td><td>One managed Postgres. Auth issues JWTs; RLS policies on every table enforce who can read/write; Realtime streams row changes back to the browser.</td></tr>
<tr><td>Maps</td><td>Google Maps JS (everywhere); Mapbox GL (wildlife heatmap only)</td><td>Government-network compatibility pushed every interactive map to Google; only the BASH heatmap stayed on Mapbox.</td></tr>
<tr><td>PDF</td><td>jsPDF + jspdf-autotable</td><td>All 20 report generators run <em>client-side</em> — the PDF is built in the browser and never sent to a third party except the optional email attachment.</td></tr>
<tr><td>Email</td><td>Resend</td><td>Branded transactional email (invites, approvals, PDF attachments). Called only from server route handlers.</td></tr>
<tr><td>PWA</td><td>@ducanh2912/next-pwa + Workbox</td><td>Installable, offline reads, and an IndexedDB write-queue for spotty flightline connectivity.</td></tr>
</table>
<p>The dependency manifest below is the source of truth for versions.</p>
`,
  code: [
    C({ file: 'package.json', from: '"dependencies"', to: '}', caption: 'package.json — runtime dependencies (verbatim)',
      note: 'Versions here are authoritative; the prose above is a summary of these.' }),
  ],
  fits: `<p>Notice what's <em>absent</em>: no Redux/Zustand (state lives in React context + Supabase), no ORM (queries go through the supabase-js client with generated types), no GraphQL. The "shape" of almost every feature is: a page component calls a <code>lib/supabase/&lt;entity&gt;.ts</code> function, which runs a query that RLS authorizes.</p>`,
  quiz: [
    { q: 'Where are the PDF reports generated?', choices: ['On a Vercel serverless function', 'In Postgres', 'Client-side in the browser with jsPDF', 'By Resend'], answer: 2, explain: 'All 20 generators return { doc, filename } and run in the browser. The bytes only leave the device if the user emails the PDF as an attachment.' },
    { q: 'What enforces authorization for a normal table read/write?', choices: ['A Next.js middleware check', 'Row-Level Security policies in Postgres', 'The React component', 'The supabase-js client library'], answer: 1, explain: 'RLS policies on each table call the permission-matrix helpers. Even if client code is wrong, the database refuses unauthorized rows.' },
  ],
})

// ---------------------------------------------------------------------------
// TRACK: Subsystems
// ---------------------------------------------------------------------------

L({
  id: 'routing-app-shell', track: 'Subsystems', mode: 'both', kind: 'lesson',
  title: 'Routing & the app shell',
  summary: 'App Router route groups, the (app) layout provider stack, and public routes.',
  concept: `
<h4>Concept: the App Router</h4>
<p>Next.js's App Router maps folders under <code>app/</code> to URLs. A folder with a <code>page.tsx</code> is a route; a <code>layout.tsx</code> wraps every route beneath it and <em>persists</em> across navigations (it doesn't re-mount). A folder named in parentheses — like <code>(app)</code> — is a <strong>route group</strong>: it groups routes under a shared layout <em>without</em> adding a path segment. So <code>app/(app)/dashboard/page.tsx</code> serves <code>/dashboard</code>, not <code>/app/dashboard</code>.</p>
<p><strong>Server vs client components:</strong> files are server components by default (run on Vercel, can't use hooks/state). Adding <code>'use client'</code> at the top makes a component run in the browser, where it can use <code>useState</code>, effects, and the browser Supabase client. Most Glidepath pages are client components because they're interactive.</p>
<h4>Glidepath's two worlds</h4>
<ul>
  <li><strong>Authenticated app</strong> — everything under <code>app/(app)/</code> shares one shell (<code>app/(app)/layout.tsx</code>) that mounts the provider stack and chrome (sidebar, header, bottom nav).</li>
  <li><strong>Public routes</strong> — <code>/login</code>, <code>/setup-account</code>, <code>/reset-password</code>, <code>/auth/confirm</code>, the public QR forms (<code>/feedback/[baseId]</code>, <code>/[icao]/ppr-request</code>, <code>/[icao]/sms-report</code>) and <code>/kiosk/[icao]</code>. These live at the app root (there is no <code>(public)</code> group) and are allow-listed in the middleware.</li>
</ul>
<h4>The provider stack</h4>
<p>The authenticated layout nests three React contexts, outermost to innermost: <code>SidebarProvider</code> → <code>InstallationProvider</code> → <code>DashboardProvider</code>. <code>InstallationProvider</code> blocks rendering until it has loaded the current base, so every child can assume <code>installationId</code> exists. Then a stack of side-effect mounts (offline queue, page-view tracker, realtime alert banner, onboarding gates) sits alongside the page.</p>
`,
  code: [
    C({ file: 'app/(app)/layout.tsx', caption: 'app/(app)/layout.tsx — the authenticated shell (whole file)',
      annotations: [
        { lines: '', note: 'The order of the providers matters: Installation must wrap Dashboard because DashboardProvider calls useInstallation() for installationId, runways, and userRole.' },
      ] }),
  ],
  fits: `<p>Because the shell persists, navigating between modules is instant and the realtime subscriptions inside <code>DashboardProvider</code> and the sidebar badge hook stay alive across route changes. The <a data-goto="request-lifecycle-auth" href="#">middleware</a> runs <em>before</em> any of this on every request, deciding whether the user is even allowed to reach the shell.</p>`,
  quiz: [
    { q: 'Why does app/(app)/dashboard/page.tsx serve /dashboard and not /app/dashboard?', choices: ['Next.js strips the first folder', 'Parentheses make (app) a route group that adds no path segment', 'A redirect rule rewrites it', 'The layout renames it'], answer: 1, explain: 'A (group) folder organizes routes under a shared layout without contributing to the URL path.' },
    { q: 'Why must InstallationProvider wrap DashboardProvider?', choices: ['Alphabetical order', 'DashboardProvider reads installationId/runways/userRole from useInstallation()', 'They are unrelated', 'To avoid a hydration warning'], answer: 1, explain: 'DashboardProvider depends on the installation context, so it must be a descendant of InstallationProvider.' },
  ],
})

L({
  id: 'request-lifecycle-auth', track: 'Subsystems', mode: 'both', kind: 'lesson',
  title: 'The request lifecycle & the auth gate (middleware)',
  summary: 'How every request is authenticated, how tokens refresh, and what bypasses the gate.',
  concept: `
<h4>Concept: JWTs, sessions, and the cookie dance</h4>
<p>When a user signs in, Supabase Auth issues a short-lived <strong>access token</strong> (a JWT) and a long-lived <strong>refresh token</strong>, stored in cookies. The access token encodes the user id and expires quickly; the refresh token is used to mint a new access token when it does. Someone has to perform that refresh on every request and write the new cookies back — in a Next.js SSR app, that someone is the <strong>middleware</strong>.</p>
<p><strong>Middleware</strong> is code that runs on the edge <em>before</em> the matched route. Glidepath's <code>middleware.ts</code> does three jobs on every non-static request:</p>
<ol>
  <li>Build a server Supabase client wired to the request/response cookies.</li>
  <li>Call <code>auth.getUser()</code> — which validates the JWT against Supabase's servers (unlike <code>getSession()</code>, which only reads the local cookie) <em>and</em> triggers a token refresh, writing fresh cookies onto the response via <code>setAll</code>.</li>
  <li>If there's no user and the path isn't public, redirect to <code>/login</code>.</li>
</ol>
<h4>getUser() vs getSession()</h4>
<p>This distinction matters and shows up all over the codebase. <code>getUser()</code> makes a network call to verify the token — used wherever a decision grants access (middleware, API routes). <code>getSession()</code> just reads the local cookie with no verification — used for cheap "am I logged in?" checks where RLS is the real gatekeeper (e.g., the sidebar badge hook polling every 60s).</p>
`,
  code: [
    C({ file: 'middleware.ts', caption: 'middleware.ts — the auth gate (whole file)',
      annotations: [
        { lines: '9-11', note: 'Demo mode: if Supabase env vars are absent, auth is skipped entirely so the app runs on static demo data.' },
        { lines: '21-29', note: 'setAll is the token-refresh write path: Supabase hands back refreshed cookies and they are written onto a fresh response. This is why API routes can use a read-only setAll — the refresh already happened here.' },
        { lines: '33-35', note: 'getUser() validates the JWT server-side (a real network check), not just the local cookie.' },
        { lines: '57-81', note: 'isPublicPath is the allow-list: auth pages, the public QR/kiosk forms, a few semi-public API routes, and the three Vercel cron routes (which self-auth with CRON_SECRET). A cron route that is NOT listed here gets 307-redirected to /login and silently never runs — a real bug that bit this codebase.' },
        { lines: '83-87', note: 'The matcher excludes static assets so middleware only runs on real navigations and API calls.' },
      ] }),
    C({ file: 'lib/supabase/server.ts', caption: 'lib/supabase/server.ts — the SSR/server-component client',
      annotations: [
        { lines: '7-8', note: 'Null when Supabase is unconfigured — the demo-mode guard that every data function checks.' },
        { lines: '25-28', note: 'In a Server Component, cookieStore.set throws; it is swallowed because middleware already refreshed the session for this request.' },
      ] }),
    C({ file: 'lib/supabase/client.ts', caption: 'lib/supabase/client.ts — the browser client (whole file)' }),
  ],
  fits: `<p>Once middleware lets the request through, the route renders inside the <a data-goto="routing-app-shell" href="#">app shell</a>. From there, client components create the browser client with <code>createClient()</code> and call <code>lib/supabase/*</code> functions — whose queries are authorized by <a data-goto="data-model-rls" href="#">RLS</a>. The narrow set of things that need elevated privilege (admin user management, email, cron) go through <a data-goto="rpcs-and-functions" href="#">route handlers</a> using a service-role client.</p>`,
  quiz: [
    { q: 'What does auth.getUser() do that getSession() does not?', choices: ['Nothing, they are aliases', 'Validates the JWT against Supabase servers (a network call)', 'Logs the user out', 'Reads from localStorage'], answer: 1, explain: 'getUser() verifies the token server-side; getSession() only reads the local cookie. Access decisions use getUser().' },
    { q: 'A new Vercel cron route returns 307 to /login and never runs. The most likely cause?', choices: ['Wrong CRON_SECRET', 'The route path is missing from isPublicPath in middleware.ts', 'Postgres is down', 'It exported POST instead of GET'], answer: 1, explain: 'Cron requests carry no auth cookie. If the path is not in isPublicPath, middleware redirects it before the handler runs. (Exporting only POST is a different, real bug too — Vercel cron sends GET.)' },
    { q: 'Why can API route handlers use a no-op setAll when reading the session?', choices: ['They never read cookies', 'Middleware already refreshed the session and wrote cookies for this request', 'Supabase does not use cookies', 'They use the service role'], answer: 1, explain: 'The refresh + cookie write happens once, in middleware. Downstream handlers only need to read the already-fresh session.' },
  ],
})

L({
  id: 'data-model-rls', track: 'Subsystems', mode: 'both', kind: 'lesson',
  title: 'The data model & Row-Level Security',
  summary: 'Multi-tenant base_id, the permission matrix, and the standard RLS policy shape.',
  concept: `
<h4>Concept: Row-Level Security (RLS)</h4>
<p>RLS is a Postgres feature: you attach <strong>policies</strong> to a table that decide, <em>per row</em>, whether the current database role may <code>SELECT</code>/<code>INSERT</code>/<code>UPDATE</code>/<code>DELETE</code> it. With RLS on, the database itself is the authorization layer — buggy client code still can't read or write rows it shouldn't, because the policy filters them out. The policies call helper functions and read <code>auth.uid()</code> (the signed-in user's id, taken from their JWT).</p>
<h4>Multi-tenancy: base_id everywhere</h4>
<p>Glidepath hosts many bases in one database. Every operational table carries <code>base_id UUID REFERENCES bases(id)</code>, and a user is tied to bases through the <code>base_members</code> pivot. The whole security model reduces to two questions, asked by two helper functions:</p>
<ul>
  <li><code>user_has_base_access(uid, base_id)</code> — is this user a member of that base? (sys-admins pass automatically; a NULL base_id passes for legacy rows.)</li>
  <li><code>user_has_permission(uid, 'resource:action')</code> — does this user's role (or a per-user override) grant that permission key?</li>
</ul>
<h4>The permission matrix</h4>
<p>Authorization is data, not code: <code>permissions</code> (≈95 keys like <code>discrepancies:write</code>), <code>role_permissions</code> (which of 12+ roles get which keys), and <code>user_permission_overrides</code> (per-user grant/deny that wins over the role). <code>user_has_permission</code> resolves all three with <code>COALESCE(override, role_grant, FALSE)</code> — an explicit deny override always wins.</p>
<p class="callout">Three helpers only. <code>user_has_base_access</code>, <code>user_has_permission</code>, and <code>user_is_sys_admin</code>. The older <code>user_can_write</code> / <code>user_is_admin</code> / <code>user_is_base_admin_at</code> were dropped — don't reference them.</p>
`,
  code: [
    C({ file: 'supabase/migrations/2026042200_permission_matrix_scaffold.sql', from: 'CREATE OR REPLACE FUNCTION', to: '$$;',
      caption: 'The user_has_permission helper (verbatim slice from the matrix scaffold migration)',
      note: 'This is the function every write policy calls. If the anchor drift-flags in Gaps, open the file directly.',
      annotations: [
        { lines: '', note: 'Resolution order: a per-user override (grant or deny) beats the role grant; absent both, default FALSE. SECURITY DEFINER + a pinned search_path let it read the matrix tables regardless of the caller’s own RLS.' },
      ] }),
    C({ file: 'supabase/migrations/2026042208_drop_legacy_auth_helpers.sql', from: 'discrepancies', to: ';',
      caption: 'Canonical write-policy shape (discrepancies) — verbatim from the cutover migration',
      note: 'Every operational table follows this same base_id + permission-key pattern. This slice is illustrative; the file rewrites policies for many tables.' }),
  ],
  fits: `<p>This is why the data layer is so thin: a <code>lib/supabase/*</code> function just runs a query, and the database decides what comes back. It's also why the <a data-goto="rpcs-and-functions" href="#">SECURITY DEFINER RPCs</a> exist — when a role needs to write only <em>some</em> columns (CES updating a discrepancy status, Safety updating RSC/BWC), a narrow RPC does the privileged write after checking one specific permission key.</p>`,
  quiz: [
    { q: 'With RLS enabled, if the React code accidentally queries another base’s discrepancies, what happens?', choices: ['It returns them — RLS is client-side', 'Postgres filters them out; the policy denies rows the user has no base access to', 'The app crashes', 'Supabase emails an admin'], answer: 1, explain: 'RLS is enforced in the database. The SELECT policy requires user_has_base_access(auth.uid(), base_id), so foreign-base rows never come back.' },
    { q: 'A user’s role grants discrepancies:write, but they have a per-user override denying it. Can they write?', choices: ['Yes, role wins', 'No, the deny override wins via COALESCE(override, role, FALSE)', 'Only sys-admins decide', 'Depends on base_id'], answer: 1, explain: 'user_has_permission checks the override first; an explicit FALSE override beats the role grant.' },
    { q: 'Which three RLS helper functions are current?', choices: ['user_can_write, user_is_admin, user_is_base_admin_at', 'user_has_base_access, user_has_permission, user_is_sys_admin', 'is_authenticated, has_role, can_edit', 'rls_check, base_check, perm_check'], answer: 1, explain: 'The legacy trio was dropped in migration 2026042208. Only the three matrix helpers remain.' },
  ],
})

L({
  id: 'rpcs-and-functions', track: 'Subsystems', mode: 'both', kind: 'lesson',
  title: 'Server logic: route handlers + Postgres RPCs (the "Edge Functions" question)',
  summary: 'There are no Supabase Edge Functions. Privileged work lives in /api handlers and SECURITY DEFINER RPCs.',
  concept: `
<h4>Setting the record straight</h4>
<p>Glidepath has <strong>no Supabase Edge Functions</strong> (the Deno-based serverless product). The two real mechanisms for privileged or server-only work are:</p>
<ol>
  <li><strong>Next.js route handlers</strong> — files named <code>route.ts</code> under <code>app/api/</code> (23 of them). They run as Node functions on Vercel. They can hold secrets (<code>SUPABASE_SERVICE_ROLE_KEY</code>, <code>RESEND_API_KEY</code>, <code>CRON_SECRET</code>) that must never reach the browser. Examples: admin user management, sending email via Resend, the FAA NOTAM proxy, and the three daily cron jobs.</li>
  <li><strong>Postgres <code>SECURITY DEFINER</code> RPCs</strong> — SQL functions that run with the <em>definer's</em> privileges, bypassing the caller's RLS, but only after checking one narrow permission themselves. They exist for two reasons: (a) column-scoped writes (CES may change only a discrepancy's status, Safety only RSC/BWC), and (b) <em>public</em> writes from anonymous visitors (submitting a PPR request or a safety report) without exposing the underlying tables.</li>
</ol>
<h4>SECURITY DEFINER, explained</h4>
<p>A normal function runs as the calling role (so RLS still applies). A <code>SECURITY DEFINER</code> function runs as whoever <em>created</em> it (typically a superuser-ish role), so RLS is skipped inside it. That's powerful and dangerous, so each one re-implements exactly the check it needs (e.g. <code>user_has_permission(caller, 'discrepancies:transition:ces_statuses')</code>) and writes only the specific columns, plus an audit row.</p>
<h4>Cron handlers</h4>
<p>Three route handlers double as Vercel cron jobs (schedules in <code>vercel.json</code>): the AMTR due-reconcile (12:00 UTC), training-expiry digest (13:00), and annual-review digest (13:30). They export <strong>both GET and POST</strong> (Vercel cron invokes with GET; POST is for manual testing) and authenticate with a <code>Bearer CRON_SECRET</code> header instead of a user cookie.</p>
`,
  code: [
    C({ file: 'vercel.json', caption: 'vercel.json — cron schedules (whole file)' }),
    C({ file: 'app/api/send-pdf-email/route.ts', caption: 'app/api/send-pdf-email/route.ts — a representative route handler (whole file)',
      annotations: [
        { lines: '', note: 'Pattern to notice: read the session with getUser() for authorization, then use a service-role client only for the privileged bit (downloading the temp PDF from Storage) and Resend for delivery. Secrets stay server-side.' },
      ] }),
  ],
  fits: `<p>The RPCs are the bridge between the <a data-goto="data-model-rls" href="#">RLS model</a> and real workflows where a role legitimately needs to write a slice it doesn't broadly own. You'll meet them again in the discrepancy and airfield-status flows, and in the public PPR/feedback/SMS submission paths.</p>`,
  quiz: [
    { q: 'Does Glidepath use Supabase Edge Functions?', choices: ['Yes, extensively', 'No — it uses Next.js route handlers and Postgres RPCs', 'Only for email', 'Only for cron'], answer: 1, explain: 'There are zero Supabase Edge Functions. Server logic is Next.js /api route handlers plus SECURITY DEFINER RPCs.' },
    { q: 'What is the point of a SECURITY DEFINER RPC here?', choices: ['To make queries faster', 'To run with elevated rights and do a narrow, permission-checked write that the caller could not do directly', 'To bypass authentication', 'To cache results'], answer: 1, explain: 'It bypasses the caller’s RLS but only after checking one specific permission, enabling column-scoped or public writes safely.' },
    { q: 'Why do the cron route handlers export both GET and POST?', choices: ['Redundancy', 'Vercel cron invokes with GET; POST is kept for manual testing', 'GET is for reads, POST for writes', 'Next.js requires both'], answer: 1, explain: 'Vercel cron sends a GET. A POST-only handler returns 405 to the scheduler — a bug this codebase hit and fixed by exporting a shared handler as both.' },
  ],
})

L({
  id: 'realtime', track: 'Subsystems', mode: 'both', kind: 'lesson',
  title: 'Realtime — WebSockets, pub/sub, and postgres_changes',
  summary: 'How Postgres row changes stream to the browser, and the connection-health pattern.',
  concept: `
<h4>Concept: WebSockets & pub/sub</h4>
<p>A normal HTTP request is one round-trip: ask, answer, done. A <strong>WebSocket</strong> is a persistent two-way connection held open between browser and server, so the server can <em>push</em> data without being asked. <strong>Pub/sub</strong> (publish/subscribe) is the messaging pattern on top: publishers emit events to named <em>channels</em>; subscribers to a channel receive them. Nobody addresses anyone directly — they just agree on the channel name.</p>
<h4>Supabase Realtime + postgres_changes</h4>
<p>Supabase watches the Postgres write-ahead log (logical replication) and, when a row changes, publishes a <code>postgres_changes</code> event. A browser opens a channel and says "tell me about <code>UPDATE</code>s on <code>airfield_status</code> where <code>base_id = &lt;this base&gt;</code>." When any client commits such an update, every subscriber gets the new row and updates its UI — no refresh. <strong>RLS still applies</strong>: you only receive changes to rows you're allowed to read.</p>
<h4>Glidepath's wrapper</h4>
<p>Realtime can silently drop (gov networks throttle WebSockets). So Glidepath wraps every subscription in <code>subscribeWithErrorHandling</code>, which tracks a module-level <code>connected</code> flag. After a user takes an action that <em>relies</em> on a realtime push (e.g. changing airfield status), <code>warnIfRealtimeDown()</code> shows a one-time toast: "saved, but other users may need to refresh." The warning fires at action time, not on page load — so it's actionable, not noise.</p>
<p>Realtime is a best-effort accelerator, never the source of truth. Every realtime consumer also has a <strong>polling fallback</strong> (the dashboard re-fetches every 30s; the sidebar badges every 60s), gated on tab visibility to avoid hammering Supabase from backgrounded tabs.</p>
`,
  code: [
    C({ file: 'lib/realtime-subscribe.ts', caption: 'lib/realtime-subscribe.ts — the shared subscription wrapper (whole file)',
      annotations: [
        { lines: '37-47', note: 'subscribeWithErrorHandling flips the connected flag on SUBSCRIBED / CHANNEL_ERROR / TIMED_OUT. It never throws — a dead socket degrades to polling, it does not crash the page.' },
        { lines: '22-29', note: 'warnIfRealtimeDown is called from mutation paths (see markLocalUpdate in the dashboard context) so the user learns about a dead socket exactly when it matters.' },
      ] }),
  ],
  fits: `<p>This wrapper is used by the dashboard status context, the realtime alert banner, and the status page. The most complete example — write on one client, live re-render on another — is the <a data-goto="flow-airfield-status" href="#">flagship airfield-status flow</a>, which you should read next.</p>`,
  quiz: [
    { q: 'In pub/sub, how do a publisher and subscriber find each other?', choices: ['By IP address', 'They both use the same named channel; neither addresses the other directly', 'Through a central registry call', 'They do not — it is request/response'], answer: 1, explain: 'Publish/subscribe is decoupled: messages go to a channel name, and any subscriber to that channel receives them.' },
    { q: 'If the realtime WebSocket silently dies, does the dashboard stop updating?', choices: ['Yes, permanently', 'No — a visibility-gated polling fallback (30s) keeps it fresh, and a toast warns the user', 'It reloads the page', 'It switches to email'], answer: 1, explain: 'Realtime is best-effort. Polling fallbacks keep data current and warnIfRealtimeDown surfaces a one-time warning.' },
    { q: 'Can a user receive realtime changes for a base they have no access to?', choices: ['Yes', 'No — RLS applies to realtime too; you only get rows you may read', 'Only sys-admins', 'Only with a service role'], answer: 1, explain: 'Realtime respects RLS. The postgres_changes stream is filtered to rows the subscriber is authorized to see.' },
  ],
})

// ---------------------------------------------------------------------------
// FLOWS (interactive step-throughs). kind:'flow'
// ---------------------------------------------------------------------------

L({
  id: 'flow-airfield-status', track: 'Subsystems', mode: 'both', kind: 'flow',
  title: 'FLAGSHIP FLOW — a runway status change, end to end',
  summary: 'Click through every stage: one operator suspends a runway, and another operator’s screen updates live.',
  concept: `
<p>This is the canonical "how a request flows" walkthrough and the clearest example of genuine cross-client realtime in the app. Scenario: <strong>Operator A</strong> on the Airfield Status board suspends runway 06L/24R. <strong>Operator B</strong>, watching the dashboard on another device, sees it change within a second — no refresh.</p>
<p>Use the stepper below: <strong>Next / Prev</strong> moves one stage at a time; each stage names the exact file, the real code, and what's happening.</p>
<p class="callout">Why this flow and not "realtime discrepancy update"? Discrepancies do <em>not</em> live-update the list across clients — only the sidebar "to verify" badge refreshes. <code>airfield_status</code> is the path that truly re-renders another client's UI live. The discrepancy path is covered as a <a data-goto="flow-discrepancy" href="#">secondary flow</a>, shown accurately.</p>
`,
  stages: [
    {
      title: 'A clicks "Suspend" on runway 06L/24R',
      where: 'app/(app)/page.tsx → DashboardContext',
      detail: `Operator A's Airfield Status board calls <code>setRunwayStatusForRunway('06L/24R', 'suspended', remarks, eta)</code> from the dashboard context. This is an optimistic UI: local React state updates immediately so A sees the change instantly, then the write is persisted.`,
      code: C({ file: 'lib/dashboard-context.tsx', from: 'const setRunwayStatusForRunway', to: '}, [runwayStatuses, runwayLabels, persistRunwayStatuses])',
        caption: 'setRunwayStatusForRunway — optimistic local update, then persist' }),
    },
    {
      title: 'markLocalUpdate() tags this as a self-write',
      where: 'lib/dashboard-context.tsx',
      detail: `Before persisting, <code>persistRunwayStatuses</code> calls <code>markLocalUpdate()</code>. It stamps a timestamp (so the 30s poller won't clobber the optimistic value for 15s), dispatches a <code>glidepath:local-status-update</code> window event (so <em>A's own</em> realtime alert banner stays quiet), and calls <code>warnIfRealtimeDown()</code> so A is warned if the socket is dead.`,
      code: C({ file: 'lib/dashboard-context.tsx', from: 'const markLocalUpdate', to: '}, [])',
        caption: 'markLocalUpdate — suppress self-alerts, guard the poller, warn if offline' }),
    },
    {
      title: 'The write: UPDATE airfield_status',
      where: 'lib/supabase/airfield-status.ts',
      detail: `<code>persistRunwayStatuses</code> calls <code>updateAirfieldStatus(...)</code>. It finds the single status row for this base, stamps <code>updated_by</code> and <code>updated_at</code>, and runs an <code>UPDATE</code>. There is one <code>airfield_status</code> row per base.`,
      code: C({ file: 'lib/supabase/airfield-status.ts', from: 'export async function updateAirfieldStatus', to: '\n  return true\n}',
        caption: 'updateAirfieldStatus — the actual UPDATE' }),
    },
    {
      title: 'RLS authorizes the write in Postgres',
      where: 'Postgres policy on airfield_status',
      detail: `The <code>UPDATE</code> only succeeds because the policy <code>user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'airfield_status:write')</code> passes for Operator A. A Safety-role user, who lacks the broad write, would instead route through the <code>safety_update_rsc_bwc</code> RPC for RSC/BWC fields — see the secondary note below.`,
      code: C({ file: 'lib/supabase/airfield-status.ts', from: 'export async function safetyUpdateRscBwc', to: '\n  return { error: null }\n}',
        caption: 'safetyUpdateRscBwc — the narrow RPC path for the Safety role (contrast)' }),
    },
    {
      title: 'Postgres publishes a postgres_changes event',
      where: 'Supabase Realtime',
      detail: `The committed <code>UPDATE</code> hits the write-ahead log. Supabase Realtime publishes a <code>postgres_changes</code> event for <code>airfield_status</code> to every subscriber whose filter matches <code>base_id = &lt;this base&gt;</code> — and who is allowed to read the row. No application code runs here; it's the database streaming the change.`,
      code: null,
    },
    {
      title: 'B’s DashboardProvider receives the new row',
      where: 'lib/dashboard-context.tsx (Operator B’s browser)',
      detail: `Operator B's browser has an open channel <code>airfield_status:&lt;baseId&gt;</code> subscribed to <code>UPDATE</code> events. The callback receives <code>payload.new</code> and pushes every field into local React state — including <code>runway_statuses</code>. B's components re-render with 06L/24R now showing "suspended". This is the live cross-client update.`,
      code: C({ file: 'lib/dashboard-context.tsx', from: '// Realtime: subscribe to airfield_status', to: '}, [installationId])',
        caption: 'The realtime subscription that updates Operator B’s screen' }),
    },
    {
      title: 'The alert banner announces it (for B, not A)',
      where: 'components/realtime-alert-banner.tsx',
      detail: `A separate subscription drives a top-of-screen banner so B is actively notified of the change made by someone else. It diffs against the previous status and suppresses the banner when the change was local (the <code>glidepath:local-status-update</code> event from step 2), so A is never alerted to A's own action.`,
      code: null,
    },
    {
      title: 'Safety net: visibility-gated polling',
      where: 'lib/dashboard-context.tsx',
      detail: `If B's WebSocket had been dead, B would still converge: <code>DashboardProvider</code> re-fetches <code>airfield_status</code> every 30s while the tab is visible. The 15s local-update guard from step 2 prevents that poll from overwriting A's own optimistic value mid-flight.`,
      code: C({ file: 'lib/dashboard-context.tsx', from: '// Polling fallback: re-fetch airfield_status', to: '}, [loaded, refreshStatus])',
        caption: 'The 30s visibility-gated polling fallback' }),
    },
  ],
  quiz: [
    { q: 'Why does Operator A’s own realtime alert banner stay silent when A makes the change?', choices: ['Banners are disabled', 'markLocalUpdate() dispatches glidepath:local-status-update, which the banner uses to suppress self-alerts', 'A has no permission', 'The socket is off'], answer: 1, explain: 'The banner diffs incoming changes and ignores ones flagged as local via the window event set in markLocalUpdate().' },
    { q: 'What carries the change from Postgres to Operator B’s browser?', choices: ['A polling request from B', 'A Supabase Realtime postgres_changes event over a WebSocket', 'An email', 'A service worker push'], answer: 1, explain: 'The committed UPDATE is published as a postgres_changes event to B’s open channel; B’s callback updates state.' },
    { q: 'If B’s WebSocket is dead, how does B still get the update?', choices: ['It does not', 'The 30s visibility-gated polling fallback re-fetches airfield_status', 'B must log out and back in', 'A resends it'], answer: 1, explain: 'Realtime is best-effort; the dashboard context polls every 30s while visible as the safety net.' },
    { q: 'A Safety-role user changes RSC. Why might the write go through an RPC instead of updateAirfieldStatus?', choices: ['RPCs are faster', 'Safety lacks broad airfield_status:write, so safety_update_rsc_bwc does a narrow, permission-checked write', 'To skip realtime', 'Random choice'], answer: 1, explain: 'The Safety role only holds the narrow RSC/BWC permission, so it routes through the SECURITY DEFINER RPC that checks exactly that.' },
  ],
})

L({
  id: 'flow-discrepancy', track: 'Subsystems', mode: 'both', kind: 'flow',
  title: 'SECONDARY FLOW — a discrepancy status change (shown accurately)',
  summary: 'What really happens across clients when a discrepancy moves to "work complete" — the badge, not the list.',
  concept: `
<p>People assume discrepancies live-update across clients like airfield status. They don't, and it's important to understand the real behavior. When Operator A changes a discrepancy's status, Operator B's <strong>discrepancy list does not change</strong> until B refreshes. The only cross-client realtime effect is the sidebar's green "<em>N to verify</em>" <strong>badge</strong> recomputing.</p>
<p>This flow is seeded here so the stages are accurate; the full code embeds land when the Discrepancies module section is built. For now, the shape:</p>
<ol>
  <li><strong>A submits the change</strong> — either <code>updateDiscrepancyStatus</code> / <code>updateDiscrepancy</code> (most roles) or the <code>ces_update_discrepancy</code> RPC (CES role, column-scoped), writing the row plus an audit entry in <code>status_updates</code>.</li>
  <li><strong>RLS gate</strong> — <code>user_has_base_access AND user_has_permission('discrepancies:write')</code>, or the CES permission inside the RPC.</li>
  <li><strong>postgres_changes</strong> fires on the <code>discrepancies</code> table.</li>
  <li><strong>B’s only subscriber</strong> is the sidebar badge hook (<code>use-sidebar-badge-counts.ts</code>), filtered to this base. It re-runs <code>fetchPendingVerificationCount</code> and updates the green dot. <strong>B’s open list/detail page has no subscription</strong> and won’t change until navigation or refresh.</li>
</ol>
<p class="callout">Contrast with the flagship: airfield status re-renders the whole board for other clients; discrepancies only nudge a badge. Same database mechanism, very different UI wiring — a great lesson in "realtime is only as live as the component that subscribes."</p>
`,
  stages: [],
  quiz: [
    { q: 'Operator A marks a discrepancy "work complete". What does Operator B (viewing the discrepancy list) see immediately?', choices: ['The row updates live', 'Nothing in the list changes; only the sidebar green "to verify" badge recomputes', 'A popup', 'The page reloads'], answer: 1, explain: 'No list/detail realtime subscription exists. Only use-sidebar-badge-counts subscribes to the discrepancies table, so only the badge updates live.' },
    { q: 'How does the CES role write a discrepancy status?', choices: ['Direct UPDATE like everyone', 'Through the ces_update_discrepancy SECURITY DEFINER RPC, which is column-scoped', 'It cannot', 'Via email'], answer: 1, explain: 'CES holds only the narrow transition permission, so it uses the RPC that writes specific columns and an audit row.' },
  ],
})

// ---------------------------------------------------------------------------
// GLOSSARY
// ---------------------------------------------------------------------------

const glossary = [
  ['WebSocket', 'A persistent two-way connection between browser and server, letting the server push data without being asked. Supabase Realtime rides on it.'],
  ['Pub/sub (publish/subscribe)', 'A messaging pattern where publishers emit events to a named channel and any subscriber to that channel receives them, with no direct addressing.'],
  ['postgres_changes', 'A Supabase Realtime event emitted when a table row changes (via Postgres logical replication). Subscribers get the new/old row, filtered by RLS.'],
  ['Logical replication / WAL', 'Postgres’ write-ahead log of committed changes. Supabase reads it to know what to broadcast over Realtime.'],
  ['RLS (Row-Level Security)', 'Postgres feature where policies decide, per row, whether the current role may read/write it. Glidepath’s authorization lives here.'],
  ['RLS policy', 'A rule attached to a table for SELECT/INSERT/UPDATE/DELETE; it returns true/false per row, usually by calling helper functions with auth.uid().'],
  ['SECURITY DEFINER', 'A Postgres function that runs with its creator’s privileges (bypassing the caller’s RLS). Used for narrow, permission-checked or public writes.'],
  ['RPC', 'Remote Procedure Call. In Supabase, calling a Postgres function from the client via supabase.rpc(name, args).'],
  ['Supabase Edge Function', 'A Deno-based serverless function product. Glidepath does NOT use these — its server logic is Next.js route handlers + Postgres RPCs.'],
  ['Route handler', 'A Next.js file (app/api/.../route.ts) exporting GET/POST/etc. Runs as a Node function on Vercel; can hold secrets.'],
  ['Middleware', 'Code that runs on the edge before the matched route. Glidepath’s middleware.ts is the auth gate and token-refresh point.'],
  ['JWT', 'JSON Web Token — a signed token encoding identity/claims. Supabase’s access token is a JWT carrying the user id.'],
  ['Access token vs refresh token', 'The access token (JWT) is short-lived and authorizes requests; the refresh token is long-lived and used to mint new access tokens.'],
  ['Session', 'The pair of tokens representing a signed-in user, stored in cookies and refreshed by middleware.'],
  ['getUser() vs getSession()', 'getUser() validates the JWT with Supabase (network call); getSession() only reads the local cookie. Access decisions use getUser().'],
  ['App Router', 'Next.js routing where folders under app/ map to URLs, with server components by default and nested persistent layouts.'],
  ['Route group', 'A folder in parentheses, e.g. (app), that shares a layout without adding a URL path segment.'],
  ['Server component', 'A React component that runs on the server by default — no hooks/state, can’t use the browser.'],
  ['Client component', 'A component with ‘use client’ at the top; runs in the browser and can use state, effects, and the browser Supabase client.'],
  ['Hydration', 'The process of attaching React event handlers to server-rendered HTML so it becomes interactive.'],
  ['Service-role key', 'A Supabase key that bypasses RLS entirely. Server-only; never shipped to the browser. Used in admin/email/cron handlers.'],
  ['Anon key', 'The public Supabase key used by the browser client. Safe to ship; RLS still governs what it can access.'],
  ['Optimistic update', 'Updating local UI state immediately on a user action, before the server write confirms, for instant feedback.'],
  ['Upsert', 'Insert-or-update: write a row, updating it if a conflicting key already exists.'],
  ['UUID', 'A 128-bit unique identifier; every Glidepath primary key and base_id is a UUID.'],
  ['JSONB', 'Postgres’ binary JSON column type. Used for flexible blobs like advisories, draft_data, column_values.'],
  ['Foreign key', 'A column referencing another table’s primary key, enforcing referential integrity (e.g. base_id -> bases.id).'],
  ['base_id (multi-tenancy)', 'The column on every operational table tying a row to one base; the anchor of the whole RLS model.'],
  ['Permission matrix', 'The data-driven authorization model: permissions x role_permissions x user_permission_overrides, resolved by user_has_permission.'],
  ['CRON_SECRET', 'A shared secret in a Bearer header that Vercel cron routes check, since cron requests carry no auth cookie.'],
  ['Demo mode', 'When Supabase env vars are absent, createClient() returns null and the app serves static demo data; middleware skips auth.'],
  ['PWA', 'Progressive Web App — installable, offline-capable. Glidepath uses @ducanh2912/next-pwa + Workbox.'],
  ['Service worker', 'A background script the browser runs to cache assets and enable offline; the heart of the PWA.'],
  ['IndexedDB', 'A browser database; Glidepath’s offline write-queue and pending photos live here.'],
  ['Workbox', 'Google’s service-worker toolkit used for runtime caching of offline reads.'],
  ['jsPDF', 'A client-side PDF library; all 20 Glidepath report generators build PDFs in the browser.'],
  ['Resend', 'The transactional email provider, called only from server route handlers, that sends branded mail and PDF attachments.'],
  ['Zulu time', 'UTC, written as HHMM‘Z’. Airfield ops run on Zulu; Glidepath formats almost all timestamps this way.'],
  ['ICAO', 'The 4-letter airport code (e.g. KMTC). Used for base lookup, NOTAM sync, and public form URLs.'],
  ['NOTAM', 'Notice to Air Missions — a time-bound advisory. Glidepath shows the live FAA feed via a server proxy.'],
  ['Sonner', 'The toast-notification library used for success/error/warning messages at call sites.'],
]

// ---------------------------------------------------------------------------
// REFERENCE: a small seed table catalog (expanded as modules land)
// ---------------------------------------------------------------------------

const tables = [
  ['bases', 'One row per installation/base. Holds timezone, enabled_modules, airport_type (usaf|faa_part139), ce_shops, setup_progress, map_provider, and many config columns.'],
  ['base_members', 'Pivot: which users belong to which bases (+ role). The backbone of user_has_base_access.'],
  ['profiles', 'One row per auth user: role, status, rank, unit, primary_base_id, sidebar_config, default_pdf_email.'],
  ['airfield_status', 'One row per base — the live board: runway_statuses (JSONB), advisories, RSC/RCR, BWC, ARFF, AFM out-of-office/closed. The flagship realtime table.'],
  ['discrepancies', 'Airfield deficiencies with the CES work-order lifecycle (status + current_status). Audited in status_updates.'],
  ['status_updates', 'Append-only audit trail of discrepancy status/notes changes.'],
  ['airfield_checks', 'The 7 check types (FOD, BASH, RSC/RCR, IFE, ...), draft_data, started_at/completed_at.'],
  ['inspections', 'Daily airfield/lighting inspections, ACSI-style items JSON, one-per-day lock, BWC/RSC snapshot.'],
  ['notams', 'Local NOTAMs only; FAA NOTAMs are live-fetched (not stored) via /api/notams/sync.'],
  ['obstruction_evaluations', 'UFC 3-260-01 imaginary-surface results, lat/lon, height AGL, violated surfaces.'],
  ['permissions / role_permissions / user_permission_overrides', 'The permission matrix: ~95 keys x 12+ roles, plus per-user overrides.'],
  ['photos', 'Entity-scoped photos (discrepancy_id/check_id/inspection_id/...), storage_path in the photos bucket.'],
  ['activity_log', 'The Events Log (AF Form 3616 equivalent): entity_type/id, action, user, metadata.'],
  ['ppr_entries / ppr_columns / ppr_coordination / ppr_agencies', 'Prior Permission Required: log, per-base form columns, agency coordination.'],
  ['qrc_templates / qrc_executions', 'Quick Reaction Checklists: templates and per-run executions (open/closed, step_responses).'],
  ['daily_reviews', 'Per-base, per-day shift sign-off slots (day/swing/mid AMSL, NAMO, AFM) with events hashes.'],
  ['amtr_* (catalog + per-member)', 'Airfield Management Training Record: catalogs (JQS/1098/...) and per-member progress + signatures.'],
  ['rate_limit_hits', 'Server-side sliding-window rate limiter state (RLS on, no policies; touched only via RPC).'],
  ['page_view_daily', 'Per-user/route/day page-view rollup, written via the record_page_view RPC.'],
]

// ============================================================================
// RENDER — assemble the data object and emit the HTML.
// ============================================================================

// ---------------------------------------------------------------------------
// Merge external JSON content files (authored per-module). Each file is an
// array of lesson objects using the SAME shape as the inline lessons, except
// `code` / `stages[].code` hold raw loadCode() SPECS (resolved here at build
// time so the verbatim source comes from the real files, never the JSON).
// ---------------------------------------------------------------------------
const CONTENT_DIR = join(__dir, 'guide-content')
function mergeContentFiles() {
  let files = []
  try { files = readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.json')).sort() }
  catch (e) { return } // no content dir yet — fine
  const incoming = []
  for (const f of files) {
    let arr
    try { arr = JSON.parse(readFileSync(join(CONTENT_DIR, f), 'utf8')) }
    catch (e) { gaps.push({ kind: 'bad-json', file: 'guide-content/' + f, detail: String(e && e.message || e) }); continue }
    if (!Array.isArray(arr)) { gaps.push({ kind: 'bad-json', file: 'guide-content/' + f, detail: 'top level is not an array' }); continue }
    for (const lesson of arr) {
      lesson._src = f
      lesson.code = (lesson.code || []).map((c) => loadCode(c))
      if (lesson.stages) lesson.stages = lesson.stages.map((s) => ({ ...s, code: s.code ? loadCode(s.code) : null }))
      incoming.push(lesson)
    }
  }
  // Stable order for the Modules track: by optional `order`, then title.
  incoming.sort((a, b) => (a.order || 999) - (b.order || 999) || String(a.title).localeCompare(String(b.title)))
  for (const l of incoming) lessons.push(l)
}
mergeContentFiles()

const aiContext = [
  'You are a senior engineer who knows the Glidepath codebase intimately and answers questions about it.',
  'Glidepath is a Next.js 14 (App Router) PWA for USAF airfield management, deployed on Vercel with a Supabase backend (Postgres + Auth + Realtime + Storage).',
  'KEY FACTS:',
  '- No Supabase Edge Functions. Server logic = Next.js route handlers (app/api/*/route.ts) + Postgres SECURITY DEFINER RPCs.',
  '- Authorization is RLS via a permission matrix: helpers user_has_base_access(uid,base_id), user_has_permission(uid,"resource:action"), user_is_sys_admin(uid). Every operational table has base_id and RLS.',
  '- Standard write policy: user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), "resource:write").',
  '- Auth: middleware.ts is the gate; getUser() validates JWT + refreshes cookies; isPublicPath allow-lists auth pages, public QR/kiosk forms, and cron routes (Bearer CRON_SECRET).',
  '- Data layer: ~44 lib/supabase/*.ts CRUD modules; createClient() returns null in demo mode; friendlyError() maps RLS/constraint errors; Sonner toasts.',
  '- Realtime: subscribeWithErrorHandling + warnIfRealtimeDown; airfield_status is the true cross-client live-update table; discrepancies only update the sidebar badge across clients.',
  '- PDFs: 20 client-side jsPDF generators returning { doc, filename }; emailed via sendPdfViaEmail -> /api/send-pdf-email -> Resend.',
  'If you are unsure, say so. Prefer citing real file paths. Do not invent code.',
].join('\n')

// Always-on accuracy notes (the spec asks us to flag what's summarized vs.
// verbatim, and anything uncertain). These join any build-time anchor gaps.
gaps.push(
  { kind: 'accuracy', file: '(all prose)', detail: 'Concept, "How it fits", and quiz text are explanatory summaries written for this guide. ONLY the code blocks are verbatim — they are read from your real files at build time, so they cannot drift.' },
  { kind: 'partial-embed', file: 'app/(app)/inspections/page.tsx, app/(app)/infrastructure/page.tsx, app/(app)/base-config/setup/page.tsx, app/(app)/page.tsx', detail: 'These very large page files (1.5k–6k lines) are embedded as representative anchored slices of the load-bearing logic, not in full. Open the file for everything else.' },
  { kind: 'documented-elsewhere', file: '.mil email deliverability', detail: 'The Microsoft Defender / Safe Links .mil deliverability constraint lives in your SRS/notes, not in repository code, so it is described but not embedded verbatim.' },
  { kind: 'no-edge-functions', file: '(architecture)', detail: 'The brief mentioned "Edge Functions." Glidepath has none (no Supabase/Deno functions). Server logic = Next.js route handlers + Postgres SECURITY DEFINER RPCs. The guide uses the real names.' },
  { kind: 'flagship-correction', file: 'discrepancies vs airfield_status', detail: 'Discrepancies do NOT live-update across clients (only the sidebar badge does). The flagship realtime walkthrough uses airfield_status, which genuinely re-renders other clients. The discrepancy path is shown as an accurate secondary flow.' },
)

const guide = {
  generatedAt: new Date().toISOString(),
  title: 'Glidepath — Interactive Codebase Guide',
  lessons,
  glossary,
  tables,
  gaps,
  aiContext,
  aiDefaultModel: 'claude-opus-4-8',
}

// JSON, with < escaped so a literal </script> in any embedded source can't
// terminate the data <script> block, and line/para separators neutralized.
const dataJson = JSON.stringify(guide)
  .replace(/</g, '\\u003c')

const CSS = `
:root{
  --bg:#0e1116; --panel:#161b22; --panel2:#1b2230; --edge:#2a3240; --edge2:#3a4556;
  --ink:#e7edf5; --ink-dim:#9aa7b8; --ink-faint:#6b7888; --accent:#4aa3ff; --accent2:#7cc4ff;
  --green:#34d399; --amber:#fbbf24; --red:#f87171; --code-bg:#0b0e13; --ln:#46506180;
  --mono:'SF Mono',ui-monospace,'Cascadia Code','JetBrains Mono',Menlo,Consolas,monospace;
  --sans:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:15px;line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-decoration:none;cursor:pointer}
a:hover{text-decoration:underline}
code{font-family:var(--mono);font-size:.88em;background:#243042;padding:1px 5px;border-radius:4px;color:#cfe2ff}
h1,h2,h3,h4{line-height:1.25;margin:1.2em 0 .5em}
h4{color:var(--accent2);font-size:1.02em;letter-spacing:.2px}
.banner{background:linear-gradient(90deg,#3a1d1d,#2a1722);border-bottom:1px solid #5a2a2a;color:#ffd9d9;font-size:12.5px;padding:7px 16px;text-align:center}
.banner strong{color:#ffb4b4}
header.top{position:sticky;top:0;z-index:30;display:flex;align-items:center;gap:12px;padding:10px 16px;background:#10151ccc;backdrop-filter:blur(8px);border-bottom:1px solid var(--edge)}
.brand{font-weight:700;letter-spacing:.3px;white-space:nowrap}
.brand .v{color:var(--ink-faint);font-weight:400;font-size:12px;margin-left:6px}
.search{flex:1;max-width:520px;position:relative}
.search input{width:100%;background:var(--panel);border:1px solid var(--edge2);border-radius:8px;color:var(--ink);padding:8px 12px 8px 32px;font-size:14px;outline:none}
.search input:focus{border-color:var(--accent)}
.search .mag{position:absolute;left:10px;top:8px;color:var(--ink-faint)}
.modes{display:flex;background:var(--panel);border:1px solid var(--edge2);border-radius:8px;overflow:hidden}
.modes button{background:transparent;border:0;color:var(--ink-dim);padding:7px 14px;font-size:13px;cursor:pointer;font-weight:600}
.modes button.active{background:var(--accent);color:#05213f}
.hbtn{background:var(--panel);border:1px solid var(--edge2);color:var(--ink-dim);border-radius:8px;padding:7px 11px;font-size:12.5px;cursor:pointer}
.hbtn:hover{border-color:var(--accent);color:var(--ink)}
.progwrap{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--ink-faint)}
.progbar{width:90px;height:7px;background:#222b38;border-radius:4px;overflow:hidden}
.progbar i{display:block;height:100%;background:linear-gradient(90deg,var(--green),var(--accent));width:0}
.layout{display:grid;grid-template-columns:300px 1fr;gap:0;align-items:start}
nav.side{position:sticky;top:56px;height:calc(100vh - 56px);overflow:auto;border-right:1px solid var(--edge);padding:14px 10px 60px;background:#0d1218}
nav .grouphdr{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--ink-faint);margin:16px 8px 6px;font-weight:700}
nav a.navitem{display:block;padding:7px 10px;border-radius:7px;color:var(--ink-dim);font-size:13.5px;border-left:2px solid transparent}
nav a.navitem:hover{background:var(--panel);text-decoration:none;color:var(--ink)}
nav a.navitem.active{background:var(--panel2);color:#fff;border-left-color:var(--accent)}
nav a.navitem.done::after{content:'✓';color:var(--green);float:right;font-size:12px}
nav a.navitem .k{display:inline-block;font-size:9px;font-weight:700;padding:1px 5px;border-radius:4px;margin-right:6px;vertical-align:middle}
.k.flow{background:#3a2a14;color:var(--amber)}
.k.mod{background:#16352a;color:var(--green)}
main{padding:26px 34px 120px;max-width:1180px}
section.topic{display:none;animation:fade .2s}
section.topic.show{display:block}
@keyframes fade{from{opacity:0;transform:translateY(4px)}to{opacity:1}}
.topic .eyebrow{font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:var(--ink-faint);font-weight:700}
.topic h2{font-size:25px;margin:.2em 0 .1em}
.topic .summary{color:var(--ink-dim);font-size:15px;margin-bottom:8px}
.topic p{margin:.6em 0}
.callout{border-left:3px solid var(--amber);background:#1d1a10;padding:10px 14px;border-radius:0 8px 8px 0;margin:14px 0;font-size:14px}
ul,ol{margin:.5em 0 .8em;padding-left:22px}
li{margin:.25em 0}
table.kv,table.ref{width:100%;border-collapse:collapse;margin:12px 0;font-size:13.5px}
table.kv th,table.kv td,table.ref th,table.ref td{border:1px solid var(--edge);padding:7px 10px;text-align:left;vertical-align:top}
table.kv th,table.ref th{background:var(--panel2);color:var(--accent2);font-weight:600}
table.kv td:first-child{color:var(--ink);white-space:nowrap;font-weight:600}
/* architecture diagram */
.arch{margin:16px 0;border:1px solid var(--edge);border-radius:12px;padding:14px;background:linear-gradient(180deg,#0c1119,#0f1622)}
.arch-layer{border:1px solid var(--edge2);background:var(--panel);border-radius:10px;padding:12px 14px;cursor:pointer;transition:.15s}
.arch-layer:hover{border-color:var(--accent);background:var(--panel2);transform:translateY(-1px)}
.arch-title{font-weight:700;color:#fff}
.arch-sub{font-size:12.5px;color:var(--ink-dim);margin-top:3px}
.arch-arrow{text-align:center;color:var(--ink-faint);font-size:11.5px;margin:7px 0;font-family:var(--mono)}
.arch-note{font-size:12px;color:var(--ink-faint);text-align:center;margin-top:8px;font-style:italic}
/* code */
.codeblock{margin:14px 0;border:1px solid var(--edge);border-radius:10px;overflow:hidden;background:var(--code-bg)}
.codehdr{display:flex;align-items:center;gap:8px;justify-content:space-between;background:#121823;border-bottom:1px solid var(--edge);padding:6px 10px;font-size:12px}
.codehdr .path{font-family:var(--mono);color:var(--accent2)}
.codehdr .meta{color:var(--ink-faint);font-size:11px}
.codehdr .whole{color:var(--amber)}
.codehdr button{background:#1c2532;border:1px solid var(--edge2);color:var(--ink-dim);border-radius:6px;font-size:11px;padding:3px 8px;cursor:pointer}
.codescroll{overflow:auto;max-height:560px}
.codeblock.expanded .codescroll{max-height:none}
.codelines{font-family:var(--mono);font-size:12.5px;line-height:1.55;min-width:100%;width:max-content}
.cl{display:flex;white-space:pre}
.cl .n{user-select:none;text-align:right;color:var(--ln);padding:0 12px 0 12px;min-width:54px;border-right:1px solid #1c2531;position:sticky;left:0;background:var(--code-bg)}
.cl .t{padding:0 14px;color:#d4dde9}
.cl.hl{background:#1a2740}
.cl.hl .n{color:var(--amber)}
.codenote{font-size:12px;color:var(--ink-faint);padding:7px 12px;border-top:1px solid var(--edge);background:#0e141d}
.annos{margin:0;border-top:1px solid var(--edge);background:#0e141d}
.anno{padding:8px 12px;border-bottom:1px solid #161d28;font-size:13px;cursor:pointer}
.anno:last-child{border-bottom:0}
.anno:hover{background:#121a24}
.anno .ln{font-family:var(--mono);font-size:11px;color:var(--amber);margin-right:8px}
/* flow stepper */
.flow{margin:18px 0;border:1px solid var(--edge);border-radius:12px;overflow:hidden}
.flowbar{display:flex;flex-wrap:wrap;gap:4px;padding:10px;background:#0c1119;border-bottom:1px solid var(--edge)}
.flowbar .dot{font-size:11px;color:var(--ink-faint);border:1px solid var(--edge2);border-radius:20px;padding:4px 10px;cursor:pointer;background:var(--panel)}
.flowbar .dot.active{background:var(--accent);color:#06223f;border-color:var(--accent);font-weight:700}
.flowbar .dot.seen{color:var(--green);border-color:#22442f}
.flowstage{padding:16px}
.flowstage .st{font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--ink-faint)}
.flowstage h3{margin:.2em 0 .1em;font-size:19px}
.flowstage .where{font-family:var(--mono);font-size:12px;color:var(--accent2);margin-bottom:8px}
.flownav{display:flex;justify-content:space-between;padding:10px 16px;border-top:1px solid var(--edge);background:#0c1119}
.flownav button{background:var(--accent);border:0;color:#06223f;font-weight:700;border-radius:8px;padding:8px 16px;cursor:pointer}
.flownav button:disabled{opacity:.4;cursor:default}
.flownav button.ghost{background:var(--panel);color:var(--ink-dim);border:1px solid var(--edge2)}
/* quiz */
.quiz{margin:22px 0 0;border:1px solid var(--edge);border-radius:12px;background:#0d1320;padding:4px 16px 16px}
.quiz h4{color:var(--green)}
.qitem{margin:14px 0;padding-bottom:6px}
.qitem .q{font-weight:600;margin-bottom:8px}
.qitem label{display:block;border:1px solid var(--edge2);border-radius:8px;padding:8px 11px;margin:5px 0;cursor:pointer;font-size:14px}
.qitem label:hover{border-color:var(--accent)}
.qitem label.correct{border-color:var(--green);background:#11251b}
.qitem label.wrong{border-color:var(--red);background:#241515}
.qitem input{margin-right:9px}
.qexplain{display:none;font-size:13px;color:var(--ink-dim);margin-top:7px;padding:9px 11px;border-left:3px solid var(--green);background:#0e1a14;border-radius:0 6px 6px 0}
.qexplain.show{display:block}
.qscore{font-size:13px;color:var(--ink-faint);margin-top:6px}
/* gaps + glossary + reference */
.gapcard{border:1px solid #4a3a1a;background:#1a1710;border-radius:10px;padding:10px 14px;margin:10px 0}
.gapcard .kind{font-family:var(--mono);font-size:11px;color:var(--amber)}
.glossitem{border-bottom:1px solid var(--edge);padding:10px 0}
.glossitem .term{font-weight:700;color:var(--accent2)}
.glossitem .def{color:var(--ink-dim);font-size:14px}
.refgrid a{display:block;padding:6px 0;border-bottom:1px solid #141b25}
.empty{color:var(--ink-faint);font-style:italic;padding:20px}
/* ai chat */
#chatfab{position:fixed;right:20px;bottom:20px;z-index:40;background:var(--accent);color:#06223f;border:0;border-radius:30px;padding:12px 18px;font-weight:700;cursor:pointer;box-shadow:0 6px 24px #0008}
#chatpanel{position:fixed;right:20px;bottom:20px;z-index:41;width:min(420px,94vw);max-height:80vh;display:none;flex-direction:column;background:var(--panel);border:1px solid var(--edge2);border-radius:14px;overflow:hidden;box-shadow:0 12px 40px #000a}
#chatpanel.open{display:flex}
#chatpanel .chdr{display:flex;justify-content:space-between;align-items:center;padding:11px 14px;background:#0e141d;border-bottom:1px solid var(--edge)}
#chatpanel .chdr b{font-size:14px}
#chatpanel .chdr small{color:var(--ink-faint);display:block;font-size:11px}
#chatpanel .setup{padding:12px 14px;border-bottom:1px solid var(--edge);font-size:12.5px;color:var(--ink-dim)}
#chatpanel .setup input{width:100%;background:var(--code-bg);border:1px solid var(--edge2);color:var(--ink);border-radius:7px;padding:7px 9px;margin-top:5px;font-size:12.5px;font-family:var(--mono)}
#chatlog{flex:1;overflow:auto;padding:12px 14px;font-size:13.5px}
#chatlog .msg{margin:8px 0;padding:9px 11px;border-radius:9px;white-space:pre-wrap}
#chatlog .me{background:#16263a;border:1px solid #20384f}
#chatlog .ai{background:#11211a;border:1px solid #1d3a2b}
#chatlog .err{background:#241516;border:1px solid #3a2020;color:#ffb4b4}
#chatform{display:flex;gap:7px;padding:10px;border-top:1px solid var(--edge)}
#chatform textarea{flex:1;background:var(--code-bg);border:1px solid var(--edge2);color:var(--ink);border-radius:8px;padding:8px;resize:none;font-family:var(--sans);font-size:13.5px;height:46px}
#chatform button{background:var(--accent);border:0;color:#06223f;font-weight:700;border-radius:8px;padding:0 14px;cursor:pointer}
.cx{background:transparent;border:0;color:var(--ink-dim);font-size:18px;cursor:pointer}
@media(max-width:860px){.layout{grid-template-columns:1fr}nav.side{position:static;height:auto;border-right:0;border-bottom:1px solid var(--edge)}main{padding:18px}}
`

// Engine JS — written WITHOUT template literals / ${ } so it can sit safely
// inside this generator's output without interpolation surprises.
const ENGINE = [
"(function(){",
"var G=JSON.parse(document.getElementById('guide-data').textContent);",
"var LS='glidepath_guide_v1';",
"var AIK='glidepath_guide_apikey';",
"var state=load();",
"function load(){try{return JSON.parse(localStorage.getItem(LS))||{visited:{},quiz:{},mode:'course'}}catch(e){return{visited:{},quiz:{},mode:'course'}}}",
"function save(){try{localStorage.setItem(LS,JSON.stringify(state))}catch(e){}}",
"var byId={};G.lessons.forEach(function(l){byId[l.id]=l});",
"function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}",
"function el(t,c,h){var e=document.createElement(t);if(c)e.className=c;if(h!=null)e.innerHTML=h;return e}",

// ---- code rendering ----
"function inRange(n,spec){if(!spec)return false;return String(spec).split(',').some(function(part){var p=part.trim();if(p.indexOf('-')>0){var a=p.split('-');return n>=+a[0]&&n<=+a[1]}return n==+p})}",
"function renderCode(cb){",
"  var wrap=el('div','codeblock');",
"  var hdr=el('div','codehdr');",
"  var left=el('div',null,'<span class=\"path\">'+esc(cb.path)+'</span> <span class=\"meta\">'+(cb.whole?'<span class=\"whole\">whole file</span>':('lines '+cb.startLine+'\\u2013'+(cb.startLine+cb.code.split('\\n').length-1)))+'</span>');",
"  var btns=el('div');",
"  var exp=el('button',null,'Expand'); exp.onclick=function(){wrap.classList.toggle('expanded');exp.textContent=wrap.classList.contains('expanded')?'Collapse':'Expand'};",
"  var cp=el('button',null,'Copy'); cp.onclick=function(){navigator.clipboard&&navigator.clipboard.writeText(cb.code);cp.textContent='Copied';setTimeout(function(){cp.textContent='Copy'},1200)};",
"  btns.appendChild(cp);btns.appendChild(exp);hdr.appendChild(left);hdr.appendChild(btns);wrap.appendChild(hdr);",
"  var sc=el('div','codescroll');var box=el('div','codelines');",
"  var lines=cb.code.split('\\n');",
"  for(var i=0;i<lines.length;i++){var ln=cb.startLine+i;var row=el('div','cl');row.setAttribute('data-ln',ln);row.appendChild(el('span','n',String(ln)));var t=el('span','t');t.textContent=lines[i].length?lines[i]:' ';row.appendChild(t);box.appendChild(row)}",
"  sc.appendChild(box);wrap.appendChild(sc);",
"  if(cb.note){wrap.appendChild(el('div','codenote',esc(cb.note)))}",
"  if(cb.annotations&&cb.annotations.length){var an=el('div','annos');cb.annotations.forEach(function(a){var d=el('div','anno',(a.lines?'<span class=\"ln\">L'+esc(a.lines)+'</span>':'')+esc(a.note));d.onclick=function(){box.querySelectorAll('.cl.hl').forEach(function(r){r.classList.remove('hl')});if(a.lines){box.querySelectorAll('.cl').forEach(function(r){if(inRange(+r.getAttribute('data-ln'),a.lines))r.classList.add('hl')});var first=box.querySelector('.cl.hl');if(first)first.scrollIntoView({block:'center',behavior:'smooth'})}};an.appendChild(d)});wrap.appendChild(an)}",
"  return wrap;",
"}",

// ---- quiz ----
"function renderQuiz(lesson){",
"  var q=lesson.quiz;if(!q||!q.length)return null;",
"  var box=el('div','quiz');box.appendChild(el('h4',null,'\\u2713 Check your understanding'));",
"  var sk=state.quiz[lesson.id]||{};",
"  q.forEach(function(item,qi){",
"    var qd=el('div','qitem');qd.appendChild(el('div','q',(qi+1)+'. '+esc(item.q)));",
"    var ex=el('div','qexplain',esc(item.explain));",
"    item.choices.forEach(function(ch,ci){",
"      var lab=el('label');var inp=document.createElement('input');inp.type='radio';inp.name=lesson.id+'_'+qi;inp.value=ci;lab.appendChild(inp);lab.appendChild(document.createTextNode(' '+ch));",
"      inp.onchange=function(){",
"        qd.querySelectorAll('label').forEach(function(l){l.classList.remove('correct','wrong')});",
"        if(ci===item.answer){lab.classList.add('correct')}else{lab.classList.add('wrong');var cl=qd.querySelectorAll('label')[item.answer];if(cl)cl.classList.add('correct')}",
"        ex.classList.add('show');",
"        sk[qi]=(ci===item.answer)?1:0;state.quiz[lesson.id]=sk;save();updateProgress();updateScoreLine(lesson,box)",
"      };",
"      qd.appendChild(lab);",
"    });",
"    qd.appendChild(ex);box.appendChild(qd);",
"  });",
"  var sl=el('div','qscore');sl.id='score_'+lesson.id;box.appendChild(sl);",
"  setTimeout(function(){updateScoreLine(lesson,box)},0);",
"  return box;",
"}",
"function updateScoreLine(lesson,box){var sk=state.quiz[lesson.id]||{};var c=0,n=lesson.quiz.length;for(var k in sk){if(sk[k])c++}var line=box.querySelector('#score_'+lesson.id);if(line)line.textContent='Score: '+c+' / '+n+(c===n?'  \\u2014 perfect':'')}",

// ---- flow stepper ----
"function renderFlow(lesson){",
"  if(!lesson.stages||!lesson.stages.length)return null;",
"  var wrap=el('div','flow');var bar=el('div','flowbar');var stageBox=el('div','flowstage');var navb=el('div','flownav');",
"  var idx=0;var seen={};",
"  var prev=el('button','ghost','\\u2190 Prev');var next=el('button',null,'Next \\u2192');",
"  function draw(){",
"    seen[idx]=true;bar.innerHTML='';lesson.stages.forEach(function(s,i){var d=el('div','dot'+(i===idx?' active':'')+(seen[i]&&i!==idx?' seen':''),String(i+1));d.onclick=function(){idx=i;draw()};bar.appendChild(d)});",
"    var s=lesson.stages[idx];stageBox.innerHTML='';stageBox.appendChild(el('div','st','Stage '+(idx+1)+' of '+lesson.stages.length));stageBox.appendChild(el('h3',null,esc(s.title)));if(s.where)stageBox.appendChild(el('div','where',esc(s.where)));stageBox.appendChild(el('div',null,s.detail||''));if(s.code)stageBox.appendChild(renderCode(s.code));",
"    prev.disabled=idx===0;next.disabled=idx===lesson.stages.length-1;",
"  }",
"  prev.onclick=function(){if(idx>0){idx--;draw()}};next.onclick=function(){if(idx<lesson.stages.length-1){idx++;draw()}};",
"  navb.appendChild(prev);navb.appendChild(next);wrap.appendChild(bar);wrap.appendChild(stageBox);wrap.appendChild(navb);draw();",
"  return wrap;",
"}",

// ---- section build ----
"var main=document.getElementById('main');",
"function buildSection(lesson){",
"  var s=el('section','topic');s.id='sec-'+lesson.id;",
"  s.appendChild(el('div','eyebrow',esc(lesson.track)+(lesson.kind==='flow'?' \\u00b7 walkthrough':'')));",
"  s.appendChild(el('h2',null,esc(lesson.title)));",
"  if(lesson.summary)s.appendChild(el('div','summary',esc(lesson.summary)));",
"  if(lesson.concept)s.appendChild(el('div',null,lesson.concept));",
"  if(lesson.kind==='flow'){var f=renderFlow(lesson);if(f)s.appendChild(f)}",
"  if(lesson.code&&lesson.code.length){s.appendChild(el('h4',null,'Your code'));lesson.code.forEach(function(cb){s.appendChild(renderCode(cb))})}",
"  if(lesson.fits){s.appendChild(el('h4',null,'How it fits'));s.appendChild(el('div',null,lesson.fits))}",
"  var qz=renderQuiz(lesson);if(qz)s.appendChild(qz);",
"  return s;",
"}",
"G.lessons.forEach(function(l){main.appendChild(buildSection(l))});",

// ---- extra reference sections (glossary, tables, gaps) ----
"function buildAux(id,title,track,node){var s=el('section','topic');s.id='sec-'+id;s.appendChild(el('div','eyebrow',esc(track)));s.appendChild(el('h2',null,esc(title)));s.appendChild(node);main.appendChild(s);byId[id]={id:id,title:title,track:track,mode:'both',kind:'aux',_search:title}}",
"var gl=el('div');G.glossary.forEach(function(g){var d=el('div','glossitem');d.appendChild(el('span','term',esc(g[0])+'  '));d.appendChild(el('span','def',esc(g[1])));gl.appendChild(d)});buildAux('glossary','Glossary','Reference',gl);",
"var tb=el('table','ref');tb.innerHTML='<tr><th>Table</th><th>What it holds</th></tr>';G.tables.forEach(function(t){var tr=document.createElement('tr');tr.innerHTML='<td><code>'+esc(t[0])+'</code></td><td>'+esc(t[1])+'</td>';tb.appendChild(tr)});var tw=el('div');tw.appendChild(el('p',null,'Seed catalog of the load-bearing tables. The full per-table column + RLS detail expands as the module sections are built.'));tw.appendChild(tb);buildAux('tables','Data tables','Reference',tw);",
"var gpv=el('div');if(!G.gaps.length){gpv.appendChild(el('div','empty','No build-time gaps: every code anchor resolved against the real files.'))}else{gpv.appendChild(el('p',null,'These are spots the generator could not pull verbatim (a missing file or an anchor that did not match), or that are summarized rather than quoted. Each is worth a manual look.'));G.gaps.forEach(function(x){var c=el('div','gapcard');c.appendChild(el('div','kind',esc(x.kind)));c.appendChild(el('div',null,'<code>'+esc(x.file||'')+'</code> \\u2014 '+esc(x.detail||'')));gpv.appendChild(c)})}buildAux('gaps','Gaps & accuracy notes','Reference',gpv);",
"var fileMap={};function addF(p,l){var a=fileMap[p]=fileMap[p]||[];if(a.indexOf(l)<0)a.push(l)}G.lessons.forEach(function(l){(l.code||[]).forEach(function(c){addF(c.path,l)});(l.stages||[]).forEach(function(s){if(s.code)addF(s.code.path,l)})});",
"var fpaths=Object.keys(fileMap).sort();var fidx=el('div','refgrid');fidx.appendChild(el('p',null,fpaths.length+' source files are embedded across the guide. Click any to jump to a section that quotes it verbatim.'));fpaths.forEach(function(p){var ls=fileMap[p];var a=el('a',null,'<code>'+esc(p)+'</code> <span style=\"color:var(--ink-faint);font-size:12px\">'+esc(ls[0].title)+(ls.length>1?(' (+'+(ls.length-1)+' more)'):'')+'</span>');a.href='#'+ls[0].id;a.onclick=function(e){e.preventDefault();go(ls[0].id)};fidx.appendChild(a)});buildAux('files','File index','Reference',fidx);",
"var ab=el('div');ab.innerHTML='<p>Generated from the real source on <b>'+esc(G.generatedAt)+'</b>.</p><p>This file embeds real application source code. Keep it local; do not commit secrets; treat it as sensitive.</p><p>Regenerate after code changes with:</p><div class=\"codeblock\"><div class=\"codescroll\"><div class=\"codelines\"><div class=\"cl\"><span class=\"t\">node docs/build-glidepath-guide.mjs</span></div></div></div></div>';buildAux('about','About & regenerate','Reference',ab);",

// ---- navigation ----
"var nav=document.getElementById('nav');",
"var ORDER=['Foundations','Subsystems','Modules','Reference'];",
"function navKind(l){return l.kind==='flow'?'<span class=\"k flow\">FLOW</span>':(l.track==='Modules'?'<span class=\"k mod\">MOD</span>':'')}",
"function buildNav(){",
"  nav.innerHTML='';var groups={};Object.keys(byId).forEach(function(id){var l=byId[id];var inMode=(state.mode==='reference')?true:(l.mode!=='reference');if(state.mode==='reference'&&l.kind==='aux'){}if(!inMode&&l.kind!=='aux')return;(groups[l.track]=groups[l.track]||[]).push(l)});",
"  var tracks=ORDER.filter(function(t){return groups[t]});",
"  if(state.mode==='reference'){tracks.forEach(function(t){groups[t].sort(function(a,b){return a.title<b.title?-1:1})})}",
"  tracks.forEach(function(t){nav.appendChild(el('div','grouphdr',t));groups[t].forEach(function(l){var a=el('a','navitem'+(state.visited[l.id]?' done':''),navKind(l)+esc(l.title));a.href='#'+l.id;a.setAttribute('data-id',l.id);a.onclick=function(e){e.preventDefault();go(l.id)};nav.appendChild(a)})});",
"  applyFilter();",
"}",
"function setActiveNav(id){nav.querySelectorAll('.navitem').forEach(function(a){a.classList.toggle('active',a.getAttribute('data-id')===id)})}",

// ---- navigate ----
"function go(id){var l=byId[id];if(!l)return;document.querySelectorAll('section.topic').forEach(function(s){s.classList.remove('show')});var sec=document.getElementById('sec-'+id);if(sec)sec.classList.add('show');setActiveNav(id);if(l.kind!=='aux'){state.visited[id]=true;save()}var n=nav.querySelector('.navitem[data-id=\"'+id+'\"]');if(n)n.classList.add('done');window.scrollTo(0,0);updateProgress();history.replaceState(null,'','#'+id)}",

// ---- search ----
"function lessonText(l){if(l._search)return l._search;var parts=[l.title,l.summary||'',l.track,(l.concept||'').replace(/<[^>]+>/g,' '),(l.fits||'').replace(/<[^>]+>/g,' ')];(l.code||[]).forEach(function(c){parts.push(c.path);parts.push(c.code)});(l.stages||[]).forEach(function(s){parts.push(s.title);parts.push((s.detail||'').replace(/<[^>]+>/g,' '));if(s.code){parts.push(s.code.path);parts.push(s.code.code)}});(l.quiz||[]).forEach(function(q){parts.push(q.q)});l._search=parts.join(' \\n ').toLowerCase();return l._search}",
"var gloHay=G.glossary.map(function(g){return (g[0]+' '+g[1]).toLowerCase()}).join(' \\n ');",
"function applyFilter(){var q=(document.getElementById('q').value||'').trim().toLowerCase();nav.querySelectorAll('.navitem').forEach(function(a){var id=a.getAttribute('data-id');var l=byId[id];var hay=lessonText(l);if(id==='glossary')hay+=' '+gloHay;a.style.display=(!q||hay.indexOf(q)>=0)?'block':'none'});var anyHdr=nav.querySelectorAll('.grouphdr');anyHdr.forEach(function(h){var n=h.nextElementSibling,vis=false;while(n&&!n.classList.contains('grouphdr')){if(n.classList.contains('navitem')&&n.style.display!=='none')vis=true;n=n.nextElementSibling}h.style.display=vis?'block':'none'})}",

// ---- progress ----
"function updateProgress(){var ls=G.lessons.length;var v=0;G.lessons.forEach(function(l){if(state.visited[l.id])v++});var qz=G.lessons.filter(function(l){return l.quiz&&l.quiz.length});var perfect=0;qz.forEach(function(l){var sk=state.quiz[l.id]||{};var c=0;for(var k in sk){if(sk[k])c++}if(c===l.quiz.length)perfect++});var pct=Math.round(((v/ls)*0.6+(perfect/(qz.length||1))*0.4)*100);document.getElementById('progi').style.width=pct+'%';document.getElementById('progt').textContent=v+'/'+ls+' read \\u00b7 '+perfect+'/'+qz.length+' quizzes'}",

// ---- mode + reset + diagram delegation ----
"function setMode(m){state.mode=m;save();document.getElementById('mc').classList.toggle('active',m==='course');document.getElementById('mr').classList.toggle('active',m==='reference');buildNav()}",
"document.getElementById('mc').onclick=function(){setMode('course')};document.getElementById('mr').onclick=function(){setMode('reference')};",
"document.getElementById('q').addEventListener('input',applyFilter);",
"document.getElementById('reset').onclick=function(){if(confirm('Reset all reading progress and quiz scores in this browser?')){state={visited:{},quiz:{},mode:state.mode};save();location.reload()}};",
"document.addEventListener('click',function(e){var g=e.target.closest('[data-goto]');if(g){e.preventDefault();go(g.getAttribute('data-goto'))}});",

// ---- AI chat ----
"var chatHist=[];",
"function chatAdd(cls,txt){var l=document.getElementById('chatlog');var m=el('div','msg '+cls);m.textContent=txt;l.appendChild(m);l.scrollTop=l.scrollHeight;return m}",
"document.getElementById('chatfab').onclick=function(){document.getElementById('chatpanel').classList.add('open');this.style.display='none';var k=localStorage.getItem(AIK);if(k)document.getElementById('aikey').value=k};",
"document.getElementById('chatclose').onclick=function(){document.getElementById('chatpanel').classList.remove('open');document.getElementById('chatfab').style.display='block'};",
"document.getElementById('aikey').addEventListener('change',function(){if(document.getElementById('airemember').checked){localStorage.setItem(AIK,this.value)}});",
"document.getElementById('chatform').onsubmit=function(e){e.preventDefault();var ta=document.getElementById('chatin');var msg=ta.value.trim();if(!msg)return;var key=document.getElementById('aikey').value.trim();if(!key){chatAdd('err','Paste your Anthropic API key above first. The rest of this guide works with no key.');return}if(document.getElementById('airemember').checked){localStorage.setItem(AIK,key)}var model=document.getElementById('aimodel').value.trim()||G.aiDefaultModel;chatAdd('me',msg);ta.value='';chatHist.push({role:'user',content:msg});var thinking=chatAdd('ai','\\u2026');",
"  fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:model,max_tokens:1200,system:G.aiContext,messages:chatHist})})",
"  .then(function(r){return r.json()}).then(function(d){if(d.error){thinking.className='msg err';thinking.textContent='API error: '+(d.error.message||JSON.stringify(d.error));return}var txt=(d.content&&d.content.map?d.content.map(function(b){return b.text||''}).join(''):'')||'(no text)';thinking.textContent=txt;chatHist.push({role:'assistant',content:txt})})",
"  .catch(function(err){thinking.className='msg err';thinking.textContent='Request failed: '+err.message+' (CORS or network). The rest of the guide is fully offline.'});",
"};",

// ---- boot ----
"buildNav();updateProgress();setMode(state.mode);var h=location.hash.replace('#','');if(h&&byId[h]){go(h)}else{go('start-here')}",
"})();"
].join('\n')

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Glidepath — Interactive Codebase Guide</title>
<style>${CSS}</style>
</head>
<body>
<div class="banner">⚠ <strong>Sensitive:</strong> this file embeds real Glidepath source code &amp; security logic. Keep it local, do not commit it to the repo, and never paste secrets/API keys into the code. The AI chat is optional and uses a key you provide at runtime.</div>
<header class="top">
  <div class="brand">Glidepath Guide<span class="v">codebase reference</span></div>
  <div class="search"><span class="mag">⌕</span><input id="q" type="search" placeholder="Search topics, files, functions, glossary…" autocomplete="off"></div>
  <div class="modes"><button id="mc" class="active">Course</button><button id="mr">Reference</button></div>
  <div class="progwrap"><div class="progbar"><i id="progi"></i></div><span id="progt"></span></div>
  <button id="reset" class="hbtn" title="Clear progress &amp; quiz scores">Reset</button>
</header>
<div class="layout">
  <nav class="side" id="nav"></nav>
  <main id="main"></main>
</div>

<button id="chatfab">💬 Ask about this codebase</button>
<div id="chatpanel">
  <div class="chdr"><div><b>Ask about this codebase</b><small>Optional · uses your own Anthropic API key · offline guide works without it</small></div><button class="cx" id="chatclose">×</button></div>
  <div class="setup">
    Your API key is used only by your browser to call api.anthropic.com directly. It is never sent anywhere else and not stored unless you tick "remember".
    <input id="aikey" type="password" placeholder="sk-ant-… (paste your Anthropic API key)">
    <input id="aimodel" type="text" placeholder="model (default: claude-opus-4-8)">
    <label style="display:block;margin-top:6px;font-size:11.5px"><input type="checkbox" id="airemember"> remember key in this browser (localStorage)</label>
  </div>
  <div id="chatlog"></div>
  <form id="chatform"><textarea id="chatin" placeholder="e.g. How does RLS gate a discrepancy write?"></textarea><button type="submit">Send</button></form>
</div>

<script id="guide-data" type="application/json">${dataJson}</script>
<script>${ENGINE}</script>
</body>
</html>`

writeFileSync(OUT, html, 'utf8')
const sizeKb = Math.round(html.length / 1024)
console.log('Wrote ' + OUT + ' (' + sizeKb + ' KB)')
console.log('Lessons: ' + lessons.length + ' | Glossary: ' + glossary.length + ' | Tables: ' + tables.length)
if (gaps.length) {
  console.log('\nBuild-time gaps (' + gaps.length + '):')
  gaps.forEach(g => console.log('  [' + g.kind + '] ' + (g.file || '') + ' :: ' + (g.detail || '')))
} else {
  console.log('No build-time gaps — all anchors resolved.')
}
