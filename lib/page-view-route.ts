// Route normalization for page-view capture.
//
// Collapses dynamic path segments (UUIDs, numeric ids) to a stable pattern so
// the daily rollup aggregates per feature ("/discrepancies/[id]") instead of
// per individual record. Pure + dependency-free so it can be unit-tested and
// reused by both the client tracker hook and any server-side normalization.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NUMERIC_RE = /^\d+$/

export function normalizeRoute(pathname: string): string {
  if (!pathname || typeof pathname !== 'string') return '/'
  // Drop query string / hash, then trim a trailing slash (but keep root "/").
  let path = pathname.split(/[?#]/)[0]
  if (path.length > 1) path = path.replace(/\/+$/, '')
  if (!path) return '/'

  const normalized = path
    .split('/')
    .map((seg) => (UUID_RE.test(seg) || NUMERIC_RE.test(seg) ? '[id]' : seg))
    .join('/')

  // Guard against pathological lengths reaching the DB.
  return normalized.length > 120 ? normalized.slice(0, 120) : normalized
}
