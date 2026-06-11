// API-boundary verification for the 2026-06-11 middleware/route fixes.
// REQUIRES a running dev server (npm run dev). Hits routes WITHOUT auth, so
// it's side-effect-free (no privileged writes) and never needs a session
// cookie. Confirms:
//   M-6  /api/forgot-password is reachable by anonymous callers (was being
//        307-redirected to /login and silently failing).
//   M-7  /<icao>/sms-report is reachable anonymously (anonymous safety report).
//   ---  protected routes (send-pdf-email, user-emails, airfield-status GET)
//        still reject unauthenticated callers.
//
//   npm run dev            # in one terminal
//   node scripts/verify-security-api.mjs            # in another
//   node scripts/verify-security-api.mjs http://localhost:3000   # custom base
//
// Exit 0 = all passed, 1 = failure / server unreachable.

const BASE = (process.argv[2] || process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')

let passed = 0
let failed = 0
function check(name, ok, detail = '') {
  if (ok) { passed++; console.log(`  ✓ ${name}`) }
  else { failed++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`) }
}

// A response is a "login bounce" if middleware redirected it to /login.
function isLoginBounce(res) {
  if (![301, 302, 307, 308].includes(res.status)) return false
  const loc = res.headers.get('location') || ''
  return loc.includes('/login')
}

async function req(method, pathname, body) {
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    redirect: 'manual',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  return res
}

async function main() {
  // Reachability probe.
  try {
    await fetch(BASE, { redirect: 'manual' })
  } catch {
    console.error(`Cannot reach ${BASE} — start the dev server first (npm run dev).`)
    process.exit(1)
  }

  console.log(`\n=== Public routes must be reachable anonymously (against ${BASE}) ===`)
  {
    // M-6: forgot-password — anonymous POST should reach the handler, not bounce
    // to /login. Fake address; no real user is affected.
    const res = await req('POST', '/api/forgot-password', { email: `nonexistent-verify-${Date.now()}@example.com` })
    check('M-6: /api/forgot-password reachable (not redirected to /login)', !isLoginBounce(res), `status=${res.status}`)
  }
  {
    // M-7: public SMS safety-report page. Dummy ICAO — the page renders a
    // not-found state for unknown bases but must NOT bounce to /login.
    const res = await req('GET', '/ZZZZ/sms-report')
    check('M-7: /<icao>/sms-report reachable (not redirected to /login)', !isLoginBounce(res), `status=${res.status}`)
  }
  {
    // Sanity: the long-public ppr-request short URL still works.
    const res = await req('GET', '/ZZZZ/ppr-request')
    check('sanity: /<icao>/ppr-request still reachable', !isLoginBounce(res), `status=${res.status}`)
  }

  console.log('\n=== Protected routes must reject unauthenticated callers ===')
  for (const [method, pathname, body] of [
    ['POST', '/api/send-pdf-email', { filename: 'x.pdf', to: 'a@b.com', subject: 's', pdfBase64: 'AA==' }],
    ['POST', '/api/user-emails', { template: 'approved', userId: '00000000-0000-0000-0000-000000000000' }],
    ['GET', '/api/airfield-status', undefined],
    // H-5: the authenticated photo proxy must reject anonymous reads.
    ['GET', '/api/photos?path=discrepancy-photos/x/y.jpg', undefined],
  ]) {
    const res = await req(method, pathname, body)
    const blocked = isLoginBounce(res) || res.status === 401 || res.status === 403
    check(`${method} ${pathname} blocked when unauthenticated`, blocked, `status=${res.status}`)
  }

  console.log(`\n${failed === 0 ? '✓ ALL PASSED' : '✗ FAILURES'} — ${passed} passed, ${failed} failed\n`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((e) => { console.error('\nverify-security-api crashed:', e.message); process.exit(1) })
