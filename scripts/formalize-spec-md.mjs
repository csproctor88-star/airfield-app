#!/usr/bin/env node
/**
 * Reformat a spec Markdown into a formal, document-style layout:
 *  - Hierarchical section numbers baked into headings (1, 1.1, 3.1.1) so they
 *    survive export to HTML / DOCX / PDF identically (no CSS-counter reliance).
 *  - Template field bullets ("- **Label** — text") become formal run-in
 *    paragraphs ("**Label.** text") — removes the AI-tell bullets + em dashes.
 *  - Em/en dashes in BODY text are cleaned: numeric ranges ("1–3", "139.401–415")
 *    become hyphens; spaced prose dashes become commas. Headings (incl. the
 *    title) and fenced code are left untouched.
 * Usage: node scripts/formalize-spec-md.mjs <input.md> [output.md]
 */
import { readFileSync, writeFileSync } from 'node:fs'

const inP = process.argv[2]
const outP = process.argv[3] || inP
if (!inP) { console.error('Usage: node scripts/formalize-spec-md.mjs <input.md> [output.md]'); process.exit(1) }

// Body-text dash cleanup (never applied to headings).
const deDash = (s) => s
  .replace(/(\d)\s*[—–]\s*(\d)/g, '$1-$2') // numeric ranges -> hyphen (first)
  .replace(/\s+[—–]\s+/g, ', ')            // spaced prose dash -> comma
  .replace(/[—–]/g, ', ')                  // any straggler

const lines = readFileSync(inP, 'utf8').replace(/\r\n/g, '\n').split('\n')
const out = []
const c = { 2: 0, 3: 0, 4: 0 }
let inFence = false

for (const raw of lines) {
  if (/^```/.test(raw)) { inFence = !inFence; out.push(raw); continue }
  if (inFence) { out.push(raw); continue }

  // Headings (h2-h4): strip existing number, assign hierarchical number. Left undashed.
  const h = raw.match(/^(#{2,4})\s+(.*)$/)
  if (h) {
    const lvl = h[1].length
    const title = h[2].replace(/^\d+(\.\d+)*\.?\s+/, '').trim()
    if (lvl === 2) { c[2]++; c[3] = 0; c[4] = 0 }
    else if (lvl === 3) { c[3]++; c[4] = 0 }
    else { c[4]++ }
    const num = lvl === 2 ? `${c[2]}` : lvl === 3 ? `${c[2]}.${c[3]}` : `${c[2]}.${c[3]}.${c[4]}`
    out.push(`${h[1]} ${num} ${title}`)
    continue
  }
  if (/^#/.test(raw)) { out.push(raw); continue } // H1 / title — leave as-is

  // Field bullet with value: "- **Label** — text" -> "**Label.** text"
  const field = raw.match(/^\s*[-*]\s+\*\*([^*]+)\*\*\s*[—–-]\s+(.*)$/)
  if (field && field[2].trim() !== '') {
    out.push(`**${field[1].trim().replace(/[.:]\s*$/, '')}.** ${deDash(field[2].trim())}`)
    continue
  }
  // Bare label bullet (header for a sub-list): "- **Key functions**" -> "**Key functions.**"
  const bare = raw.match(/^\s*[-*]\s+\*\*([^*]+)\*\*\s*[:.]?\s*$/)
  if (bare) { out.push(`**${bare[1].trim().replace(/[.:]\s*$/, '')}.**`); continue }
  // De-indent nested sub-bullets to a clean top-level list item.
  const sub = raw.match(/^\s+[-*]\s+(.*)$/)
  if (sub) { out.push(`- ${deDash(sub[1])}`); continue }

  out.push(deDash(raw))
}

writeFileSync(outP, out.join('\n'), 'utf8')
console.log(`Formalized ${outP}`)
