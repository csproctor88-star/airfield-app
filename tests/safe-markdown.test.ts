import { describe, it, expect } from 'vitest'
import { renderSafeMarkdown, markdownToPlainText, escapeHtml } from '@/lib/email/safe-markdown'

describe('renderSafeMarkdown — formatting', () => {
  it('renders h2/h3 headers', () => {
    expect(renderSafeMarkdown('## Title')).toBe('<h2>Title</h2>')
    expect(renderSafeMarkdown('### Sub')).toBe('<h3>Sub</h3>')
  })
  it('renders bullet and numbered lists', () => {
    expect(renderSafeMarkdown('- a\n- b')).toBe('<ul><li>a</li><li>b</li></ul>')
    expect(renderSafeMarkdown('1. a\n2. b')).toBe('<ol><li>a</li><li>b</li></ol>')
  })
  it('renders bold and italic', () => {
    expect(renderSafeMarkdown('**b** and *i* and _j_')).toBe('<p><strong>b</strong> and <em>i</em> and <em>j</em></p>')
  })
  it('separates paragraphs on blank lines and keeps single newlines as <br>', () => {
    expect(renderSafeMarkdown('one\ntwo\n\nthree')).toBe('<p>one<br>two</p>\n<p>three</p>')
  })
})

describe('renderSafeMarkdown — deliverability guard (no links/images survive)', () => {
  for (const evil of [
    '[click](http://evil.com)',
    'visit http://evil.com now',
    '<a href="http://evil.com">x</a>',
    '<img src="http://evil.com/p.png">',
    '<script>alert(1)</script>',
  ]) {
    it(`neutralizes: ${evil}`, () => {
      const html = renderSafeMarkdown(evil)
      expect(html).not.toMatch(/<a/i)
      expect(html).not.toMatch(/<img/i)
      expect(html).not.toMatch(/<script/i)
    })
  }
})

describe('markdownToPlainText', () => {
  it('strips formatting markers', () => {
    expect(markdownToPlainText('## Title\n\n- a\n- b\n\n**bold**')).toBe('Title\n\na\nb\n\nbold')
  })
})

describe('escapeHtml', () => {
  it('escapes the dangerous five', () => {
    expect(escapeHtml('<a href="x">&\'')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;\'')
  })
})
