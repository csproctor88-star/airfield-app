#!/usr/bin/env node
/**
 * Produce a military (USAF) or civilian (FAA Part 139) edition of a capabilities
 * doc by filtering out modules that don't apply to that airport type — mirroring
 * how the product itself hides modules per base. Keeps all non-module sections
 * (overview, platform, cross-cutting, integrations). Decision is read from each
 * module's "**Applies to.**" line. Re-run the formalizer afterward to renumber.
 * Usage: node scripts/edition-spec-md.mjs <input.md> <military|civilian> <output.md>
 */
import { readFileSync, writeFileSync } from 'node:fs'

const [, , inP, mode, outP] = process.argv
if (!inP || !mode || !outP || !['military', 'civilian'].includes(mode)) {
  console.error('Usage: node scripts/edition-spec-md.mjs <input.md> <military|civilian> <output.md>')
  process.exit(1)
}

const lines = readFileSync(inP, 'utf8').replace(/\r\n/g, '\n').split('\n')
const out = []
let i = 0
let kept = 0, dropped = 0

const keepModule = (block) => {
  const at = block.find((l) => /^\*\*Applies to\.\*\*/i.test(l)) || ''
  // Classify on the LEADING value only (Both / USAF / FAA); ignore any trailing
  // explanatory prose, which may mention the other mode.
  const val = at.replace(/^\*\*Applies to\.\*\*\s*/i, '').trim()
  if (!val) return true
  const isBoth = /^both/i.test(val)
  const isUsaf = /^usaf/i.test(val)
  const isCiv = /^faa/i.test(val)
  return mode === 'military' ? (isBoth || isUsaf) : (isBoth || isCiv)
}

while (i < lines.length) {
  const l = lines[i]
  if (/^#### /.test(l)) {
    const blk = [l]
    let j = i + 1
    while (j < lines.length && !/^(#### |### |## )/.test(lines[j])) { blk.push(lines[j]); j++ }
    if (keepModule(blk)) { out.push(...blk); kept++ } else { dropped++ }
    i = j
    continue
  }
  out.push(l)
  i++
}

let md = out.join('\n')
const label = mode === 'military' ? 'USAF Edition' : 'FAA Part 139 (Civilian) Edition'
md = md.replace(/^(# .*Capabilities Brief).*$/m, `$1 — ${label}`)
writeFileSync(outP, md, 'utf8')
console.log(`Wrote ${outP} (${mode}): kept ${kept} modules, dropped ${dropped}`)
