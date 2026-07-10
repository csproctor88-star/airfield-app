import { describe, it, expect } from 'vitest'
import { BROADCAST_SENDERS, DEFAULT_SENDER, findSender, formatFrom } from '@/lib/email/broadcast-senders'

describe('broadcast senders allowlist', () => {
  it('defaults to info@glidepathops.com (first entry)', () => {
    expect(DEFAULT_SENDER.email).toBe('info@glidepathops.com')
    expect(BROADCAST_SENDERS[0]).toEqual(DEFAULT_SENDER)
  })
  it('every sender is an @glidepathops.com address', () => {
    for (const s of BROADCAST_SENDERS) expect(s.email.endsWith('@glidepathops.com')).toBe(true)
  })
  it('findSender matches case-insensitively and rejects unknowns', () => {
    expect(findSender('CHRIS@glidepathops.com')?.email).toBe('chris@glidepathops.com')
    expect(findSender('evil@attacker.com')).toBeUndefined()
    expect(findSender('')).toBeUndefined()
    expect(findSender(null)).toBeUndefined()
  })
  it('formatFrom renders "Name <email>"', () => {
    expect(formatFrom({ email: 'chris@glidepathops.com', name: 'Chris Proctor' })).toBe('Chris Proctor <chris@glidepathops.com>')
  })
})
