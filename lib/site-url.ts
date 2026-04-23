/**
 * Resolve the public-facing base URL for server-built email / redirect links.
 *
 * Prefers NEXT_PUBLIC_SITE_URL, falls back to NEXT_PUBLIC_APP_URL (historical
 * name), and finally to the production glidepathops.com host. Callers that
 * build links like `${getSiteUrl()}/setup-account` are guaranteed to produce
 * an absolute URL — which matters because email clients append `http://` to
 * bare relative paths, producing broken `http:///setup-account` links.
 *
 * In dev we log a warning when neither env var is set so a missing Vercel
 * config is visible in the server logs instead of silently emailing broken
 * links to users.
 */
let warned = false
export function getSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://glidepathops.com'
  // Strip any quote characters a .env file round-trip might have left in,
  // plus trailing slashes so `${getSiteUrl()}/setup-account` is predictable.
  const clean = raw.trim().replace(/^['"]|['"]$/g, '').replace(/\/+$/, '')
  if (!process.env.NEXT_PUBLIC_SITE_URL && !process.env.NEXT_PUBLIC_APP_URL && !warned) {
    warned = true
    // eslint-disable-next-line no-console
    console.warn(
      '[site-url] Neither NEXT_PUBLIC_SITE_URL nor NEXT_PUBLIC_APP_URL is set — using production fallback. Configure one in your env to avoid broken email links.',
    )
  }
  return clean
}
