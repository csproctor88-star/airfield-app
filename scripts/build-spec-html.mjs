#!/usr/bin/env node
/**
 * Build a polished, self-contained HTML view of a Markdown spec.
 * Usage: node scripts/build-spec-html.mjs <input.md> <output.html> "<Title>"
 *
 * No dependencies / no CDN — all CSS + JS are inlined so the file opens
 * offline (and on locked-down networks). Renders the GFM subset the spec
 * uses: ATX headings, pipe tables, (nested) bullet lists, fenced code,
 * **bold**, *italic*, `code`, [links](url), and --- rules. Emits a sticky
 * sidebar TOC (h2/h3/h4) with a live filter box and scroll-spy highlight.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const [, , inPath, outPath, titleArg] = process.argv
if (!inPath || !outPath) {
  console.error('Usage: node scripts/build-spec-html.mjs <input.md> <output.html> "<Title>"')
  process.exit(1)
}
const md = readFileSync(inPath, 'utf8').replace(/\r\n/g, '\n')

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const usedIds = new Map()
function slug(text) {
  const base = text.toLowerCase().replace(/`/g, '').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'section'
  const n = usedIds.get(base) || 0
  usedIds.set(base, n + 1)
  return n ? `${base}-${n}` : base
}

// Inline: escape, protect code spans (printable collision-proof sentinel so
// plain numbers in prose can't be mistaken for placeholders), then links/bold/italic.
function inline(s) {
  s = esc(s)
  const codes = []
  s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `@@C${codes.length - 1}@@` })
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>')
  s = s.replace(/@@C(\d+)@@/g, (_, i) => `<code>${codes[+i]}</code>`)
  return s
}

const lines = md.split('\n')
const out = []
const toc = []
let i = 0

const isTableSep = (l) => /^\s*\|?[\s:|-]+\|?\s*$/.test(l) && l.includes('-')
const splitRow = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())

function renderList(start) {
  // Gather consecutive bullet lines; nest by leading-space (2 spaces/level).
  const items = []
  let j = start
  while (j < lines.length && /^\s*[-*] +/.test(lines[j])) {
    const m = lines[j].match(/^(\s*)[-*] +(.*)$/)
    items.push({ indent: Math.floor(m[1].length / 2), text: m[2] })
    j++
  }
  let html = ''
  let depth = 0
  for (const it of items) {
    while (depth < it.indent + 1) { html += '<ul>'; depth++ }
    while (depth > it.indent + 1) { html += '</ul>'; depth-- }
    html += `<li>${inline(it.text)}</li>`
  }
  while (depth-- > 0) html += '</ul>'
  return { html, next: j }
}

while (i < lines.length) {
  const line = lines[i]

  // Fenced code
  if (/^```/.test(line)) {
    const buf = []
    i++
    while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++ }
    i++
    out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`)
    continue
  }

  // Headings
  const h = line.match(/^(#{1,6})\s+(.*)$/)
  if (h) {
    const level = h[1].length
    const text = h[2].trim()
    const id = slug(text)
    out.push(`<h${level} id="${id}">${inline(text)}</h${level}>`)
    if (level >= 2 && level <= 4) toc.push({ level, id, text })
    i++
    continue
  }

  // Tables
  if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
    const header = splitRow(line)
    i += 2
    const rows = []
    while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(splitRow(lines[i])); i++ }
    let t = '<div class="table-wrap"><table><thead><tr>'
    t += header.map((c) => `<th>${inline(c)}</th>`).join('')
    t += '</tr></thead><tbody>'
    for (const r of rows) t += '<tr>' + header.map((_, c) => `<td>${inline(r[c] ?? '')}</td>`).join('') + '</tr>'
    t += '</tbody></table></div>'
    out.push(t)
    continue
  }

  // Horizontal rule
  if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { out.push('<hr>'); i++; continue }

  // Lists
  if (/^\s*[-*] +/.test(line)) { const r = renderList(i); out.push(r.html); i = r.next; continue }

  // Blockquote (used for the confidentiality banner)
  if (/^>\s?/.test(line)) {
    const buf = []
    while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++ }
    out.push(`<blockquote>${inline(buf.join(' '))}</blockquote>`)
    continue
  }

  // Blank
  if (line.trim() === '') { i++; continue }

  // Paragraph (gather until blank / block start)
  const para = [line]
  i++
  while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,6}\s|```|\s*[-*] |>)/.test(lines[i]) && !(lines[i].includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1]))) {
    para.push(lines[i]); i++
  }
  out.push(`<p>${inline(para.join(' '))}</p>`)
}

// Build TOC markup
const tocHtml = toc.map((t) => `<a class="toc-l${t.level}" href="#${t.id}" data-target="${t.id}">${esc(t.text.replace(/`/g, ''))}</a>`).join('\n')

const title = titleArg || 'Specification'
const generated = new Date().toISOString().slice(0, 10)

const CSS = `
:root{--bg:#0f172a;--ink:#1f2937;--muted:#64748b;--accent:#0e7490;--border:#e2e8f0;--code-bg:#f1f5f9;--th:#0f2747;}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:#f8fafc}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
.layout{display:grid;grid-template-columns:320px 1fr;align-items:start}
.sidebar{position:sticky;top:0;height:100vh;overflow:auto;background:var(--bg);color:#cbd5e1;padding:18px 14px;border-right:1px solid #0b1220}
.sidebar .brand{color:#fff;font-weight:800;font-size:15px;line-height:1.3;margin-bottom:2px}
.sidebar .sub{color:#7b8aa0;font-size:12px;margin-bottom:14px}
.filter{width:100%;padding:8px 10px;border-radius:8px;border:1px solid #243450;background:#0b1626;color:#e2e8f0;font-size:13px;margin-bottom:12px}
.filter::placeholder{color:#5b6b85}
.toc a{display:block;color:#aab6c8;padding:3px 8px;border-radius:6px;font-size:13px;border-left:2px solid transparent}
.toc a:hover{background:#172339;text-decoration:none;color:#fff}
.toc a.active{background:#15314a;color:#fff;border-left-color:#22d3ee}
.toc a.toc-l2{font-weight:700;color:#dbe5f1;margin-top:8px}
.toc a.toc-l3{padding-left:18px;font-weight:600;color:#bcc8da}
.toc a.toc-l4{padding-left:32px;color:#9fb0c8}
.toc a.hide{display:none}
.content{max-width:880px;margin:0 auto;padding:44px 52px 120px;font-family:Georgia,Cambria,"Times New Roman",serif;font-size:15.5px;color:#1a2433}
.content h1,.content h2,.content h3,.content h4{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
h1{font-size:29px;line-height:1.2;margin:0 0 6px;color:#0b2545}
.docmeta{color:var(--muted);font-size:13px;margin-bottom:28px;border-bottom:1px solid var(--border);padding-bottom:16px}
h2{font-size:22px;margin:44px 0 12px;padding-top:12px;border-top:2px solid var(--border);color:#0b2545}
h3{font-size:17px;margin:28px 0 8px;color:#0e3a5c}
h4{font-size:15px;margin:24px 0 6px;color:#0b2545;padding-bottom:4px;border-bottom:1px solid var(--border)}
p{margin:9px 0}
ul{margin:8px 0;padding-left:22px}li{margin:4px 0}
code{background:var(--code-bg);padding:1.5px 5px;border-radius:4px;font:13px/1.4 "SF Mono",ui-monospace,Menlo,Consolas,monospace;color:#9a3412}
pre{background:#0b1626;color:#e2e8f0;padding:14px 16px;border-radius:8px;overflow:auto}pre code{background:none;color:inherit;padding:0}
strong{color:#0b2545}
hr{border:0;border-top:1px solid var(--border);margin:22px 0}
blockquote{margin:16px 0;padding:11px 16px;background:#fff7ed;border:1px solid #fed7aa;border-left:4px solid #ea580c;border-radius:0 6px 6px 0;color:#7c2d12;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;font-size:13px}
.table-wrap{overflow:auto;margin:12px 0;border:1px solid var(--border);border-radius:8px}
table{border-collapse:collapse;width:100%;font-size:13.5px}
th,td{text-align:left;padding:8px 12px;border-bottom:1px solid var(--border);vertical-align:top}
th{background:var(--th);color:#fff;font-weight:600;position:sticky;top:0}
tbody tr:nth-child(even){background:#f8fafc}
tbody tr:hover{background:#eef6f9}
.totop{position:fixed;right:20px;bottom:20px;background:var(--accent);color:#fff;border:none;border-radius:50%;width:42px;height:42px;font-size:18px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.25);opacity:0;transition:opacity .2s}
.totop.show{opacity:.92}
@media(max-width:880px){.layout{grid-template-columns:1fr}.sidebar{position:static;height:auto}.content{padding:24px 18px 80px}}
@media print{.sidebar,.totop{display:none}.layout{display:block}.content{max-width:none;padding:0}h2{break-after:avoid}table,h3,h4{break-inside:avoid}}
`

const JS = `
const links=[...document.querySelectorAll('.toc a')];
const map=new Map(links.map(a=>[a.dataset.target,a]));
const obs=new IntersectionObserver((es)=>{es.forEach(e=>{if(e.isIntersecting){links.forEach(l=>l.classList.remove('active'));const a=map.get(e.target.id);if(a){a.classList.add('active');a.scrollIntoView({block:'nearest'});}}})},{rootMargin:'0px 0px -75% 0px'});
document.querySelectorAll('h2[id],h3[id],h4[id]').forEach(h=>obs.observe(h));
const f=document.getElementById('filter');
f.addEventListener('input',()=>{const q=f.value.toLowerCase();links.forEach(a=>{a.classList.toggle('hide',q&&!a.textContent.toLowerCase().includes(q));});});
const top=document.getElementById('totop');
addEventListener('scroll',()=>{top.classList.toggle('show',scrollY>500);});
top.addEventListener('click',()=>scrollTo({top:0,behavior:'smooth'}));
`

const html = [
  '<!DOCTYPE html>',
  '<html lang="en"><head><meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width,initial-scale=1">',
  `<title>${esc(title)}</title>`,
  `<style>${CSS}</style></head><body>`,
  '<div class="layout">',
  '<aside class="sidebar">',
  `<div class="brand">${esc(title)}</div>`,
  `<div class="sub">Generated from source code · ${generated}</div>`,
  '<input id="filter" class="filter" type="text" placeholder="Filter modules / sections…" aria-label="Filter">',
  `<nav class="toc">${tocHtml}</nav>`,
  '</aside>',
  '<main class="content">',
  out.join('\n'),
  '</main></div>',
  '<button id="totop" class="totop" title="Back to top">↑</button>',
  `<script>${JS}</script>`,
  '</body></html>',
].join('\n')

writeFileSync(outPath, html, 'utf8')
console.log(`Wrote ${outPath} (${html.length} bytes, ${toc.length} TOC entries)`)
