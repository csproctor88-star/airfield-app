import { describe, it, expect } from 'vitest'
import { buildBroadcastEmail } from '@/lib/email/broadcast-template'

describe('buildBroadcastEmail', () => {
  const built = buildBroadcastEmail({
    recipientName: 'MSgt Proctor',
    subject: 'Glidepath update',
    bodyMarkdown: '## Whats new\n\n- Item one\n- Item two\n\nGo to app.glidepathops.com and select Sign In.',
  })

  it('greets the recipient by name and includes rendered formatting', () => {
    expect(built.html).toContain('Hello MSgt Proctor,')
    expect(built.html).toContain('<h2>Whats new</h2>')
    expect(built.html).toContain('<li>Item one</li>')
  })
  it('has the branded header and the DoD disclaimer footer', () => {
    expect(built.html).toContain('GLIDEPATH')
    expect(built.html).toMatch(/not endorsed by.*Department of Defense/i)
  })
  it('contains NO http(s) links and NO images (mailto is allowed)', () => {
    expect(built.html).not.toMatch(/href=["']https?:/i)
    expect(built.html).not.toMatch(/<img/i)
    expect(built.html).toContain('mailto:info@glidepathops.com')
  })
  it('provides a plain-text fallback derived from the markdown', () => {
    expect(built.text).toContain('Hello MSgt Proctor,')
    expect(built.text).toContain('Whats new')
    expect(built.text).not.toContain('##')
  })
  it('falls back to a neutral greeting when name is empty', () => {
    const b = buildBroadcastEmail({ recipientName: '', subject: 's', bodyMarkdown: 'hi' })
    expect(b.html).toContain('Hello there,')
  })
})
