import { renderSafeMarkdown, markdownToPlainText, escapeHtml } from './safe-markdown'

export interface BroadcastEmailInput {
  recipientName: string
  subject: string
  bodyMarkdown: string
}
export interface BuiltEmail {
  subject: string
  html: string
  text: string
}

const DISCLAIMER =
  'Glidepath is not endorsed by, affiliated with, or associated with the Department of Defense (DoD) or any branch of the U.S. Armed Forces.'

export function buildBroadcastEmail({ recipientName, subject, bodyMarkdown }: BroadcastEmailInput): BuiltEmail {
  const name = recipientName?.trim() || 'there'
  const bodyHtml = renderSafeMarkdown(bodyMarkdown)

  const html = [
    '<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;line-height:1.55">',
    '<div style="background:#0b1f33;color:#ffffff;padding:16px 24px;font-weight:700;letter-spacing:0.06em;font-size:18px">GLIDEPATH</div>',
    '<div style="padding:24px 24px 8px">',
    `<p>Hello ${escapeHtml(name)},</p>`,
    bodyHtml,
    '</div>',
    '<div style="padding:16px 24px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px">',
    '<p>Questions? Contact <a href="mailto:info@glidepathops.com">info@glidepathops.com</a>.</p>',
    `<p>${DISCLAIMER}</p>`,
    '</div>',
    '</div>',
  ].join('\n')

  const text = [
    `Hello ${name},`,
    '',
    markdownToPlainText(bodyMarkdown),
    '',
    '—',
    'Questions? Contact info@glidepathops.com.',
    DISCLAIMER,
  ].join('\n')

  return { subject, html, text }
}
