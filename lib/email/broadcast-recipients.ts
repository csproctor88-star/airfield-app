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
