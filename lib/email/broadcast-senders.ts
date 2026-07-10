// Allowlisted From identities for broadcast email. The route validates any
// chosen `from` against this list, so it can never send from an arbitrary
// address. glidepathops.com is already Resend-verified — adding a sender is a
// one-line change, no DNS. Only add REAL mailboxes: reply-to = the chosen sender.
export interface Sender {
  email: string
  name: string
}

export const BROADCAST_SENDERS: Sender[] = [
  { email: 'info@glidepathops.com', name: 'Glidepath' },
  { email: 'chris@glidepathops.com', name: 'Chris Proctor' },
]

export const DEFAULT_SENDER: Sender = BROADCAST_SENDERS[0]

export function findSender(email: string | null | undefined): Sender | undefined {
  if (!email) return undefined
  const e = email.trim().toLowerCase()
  return BROADCAST_SENDERS.find((s) => s.email.toLowerCase() === e)
}

export function formatFrom(s: Sender): string {
  return `${s.name} <${s.email}>`
}
