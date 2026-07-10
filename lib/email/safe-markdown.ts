// The ONLY place broadcast-email formatting lives. Escapes-then-formats with no
// linkify step, so the output is a fixed allowlist of tags (p, br, strong, em,
// ul, ol, li, h2, h3) and can never emit <a> or <img> — the .mil deliverability
// guarantee (see feedback_mil_email_deliverability). Any other Markdown/HTML the
// user types is escaped and shown as literal text.

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Inline formatting, applied to ALREADY-ESCAPED text. Bold before italic so
// `**x**` is not mis-read as two italics.
function renderInline(escaped: string): string {
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
}

export function renderSafeMarkdown(md: string): string {
  const lines = (md || '').replace(/\r\n/g, '\n').split('\n')
  const blocks: string[] = []
  let i = 0
  const cell = (raw: string) => renderInline(escapeHtml(raw))

  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') { i++; continue }

    const h = /^(#{2,3})\s+(.*)$/.exec(line)
    if (h) {
      const level = h[1].length // 2 or 3
      blocks.push(`<h${level}>${cell(h[2].trim())}</h${level}>`)
      i++
      continue
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(`<li>${cell(lines[i].replace(/^[-*]\s+/, ''))}</li>`)
        i++
      }
      blocks.push(`<ul>${items.join('')}</ul>`)
      continue
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${cell(lines[i].replace(/^\d+\.\s+/, ''))}</li>`)
        i++
      }
      blocks.push(`<ol>${items.join('')}</ol>`)
      continue
    }

    const para: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{2,3})\s+/.test(lines[i]) &&
      !/^[-*]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i])
    ) {
      para.push(cell(lines[i]))
      i++
    }
    blocks.push(`<p>${para.join('<br>')}</p>`)
  }

  return blocks.join('\n')
}

export function markdownToPlainText(md: string): string {
  return (md || '')
    .replace(/\r\n/g, '\n')
    .replace(/^#{2,3}\s+/gm, '')   // headers
    .replace(/^[-*]\s+/gm, '')      // bullets
    .replace(/^\d+\.\s+/gm, '')     // numbers
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .trim()
}
