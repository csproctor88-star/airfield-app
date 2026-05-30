// Records Export — interactive offline viewer (Phase 6).
//
// Emits a self-contained viewer/ folder (index.html + styles.css + app.js +
// data.js) that opens from file:// with no server and no internet: a sidebar of
// modules with counts, a searchable/sortable table per module, and a print
// button. The record data is inlined into data.js (window.__GLIDEPATH_EXPORT__)
// so the whole thing travels inside the ZIP.
//
// The browse tables reuse the same TableModuleSpec columns + toRow the PDF
// tables use, so the viewer never drifts from the documents. Per-record/matrix
// modules (Waivers, ACSI, Training, PPR, SCN) live in documents/ as PDFs; the
// viewer lists them with counts and points there.
import { isInRange, type ExportPeriod } from './export-period'
import type { ExportFile } from './export-file'
import type { TableModuleSpec } from './export-pdf'
import type { ModuleRecords } from './export-data'
import {
  DISCREPANCIES_SPEC,
  INSPECTIONS_SPEC,
  CHECKS_SPEC,
  OBSTRUCTIONS_SPEC,
  PERSONNEL_SPEC,
  WILDLIFE_SPEC,
  DAILY_REVIEWS_SPEC,
} from './export-table-specs'
import {
  SMS_HAZARDS_SPEC,
  SMS_MITIGATIONS_SPEC,
  SMS_AUDITS_SPEC,
  SMS_MOC_SPEC,
  SMS_SAFETY_REPORTS_SPEC,
  AEP_PLANS_SPEC,
  AEP_AGENCIES_SPEC,
  AEP_DRILLS_SPEC,
  AEP_COMMS_CHECKS_SPEC,
} from './export-civilian-specs'

/** One browsable module table in the viewer. */
export interface ViewerModule {
  key: string
  label: string
  columns: string[]
  rows: string[][]
}

/** A PDF-only module the viewer can't tabulate — listed with a count + pointer. */
export interface ViewerDocRef {
  label: string
  count: number
  folder: string
}

export interface ViewerDataset {
  base: { name: string | null; icao: string | null }
  period: { kind: string; from?: string; to?: string }
  generatedAt: string
  modules: ViewerModule[]
  documents: ViewerDocRef[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface SpecJob { label: string; spec: TableModuleSpec<any>; rows: any[] }

/** Period-filter rows by the spec's natural date, then stringify via toRow. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function specToModule(label: string, spec: TableModuleSpec<any>, rows: any[], period: ExportPeriod): ViewerModule {
  const filtered = rows.filter((r) => isInRange(spec.getDate(r), period))
  return { key: spec.module.key + (spec.subName ? `:${spec.subName}` : ''), label, columns: spec.columns, rows: filtered.map((r) => spec.toRow(r)) }
}

/**
 * Build the viewer dataset from already-fetched records. Pure. Only modules the
 * user selected AND that have rows in the period appear as browse tables; the
 * PDF-only modules with data are listed under `documents`.
 */
export function buildViewerData(
  records: ModuleRecords,
  opts: { selectedKeys: string[]; period: ExportPeriod; base: { name: string | null; icao: string | null }; generatedAt: string },
): ViewerDataset {
  const sel = new Set(opts.selectedKeys)
  const period = opts.period
  const modules: ViewerModule[] = []

  // Tabular modules (one spec each).
  const tableJobs: { key: string; job: SpecJob }[] = [
    { key: 'discrepancies', job: { label: 'Discrepancies', spec: DISCREPANCIES_SPEC, rows: records.discrepancies } },
    { key: 'checks', job: { label: 'Airfield Checks', spec: CHECKS_SPEC, rows: records.checks } },
    { key: 'obstructions', job: { label: 'Obstructions', spec: OBSTRUCTIONS_SPEC, rows: records.obstructions } },
    { key: 'personnel', job: { label: 'Personnel', spec: PERSONNEL_SPEC, rows: records.personnel } },
    { key: 'wildlife', job: { label: 'Wildlife', spec: WILDLIFE_SPEC, rows: records.wildlife } },
    { key: 'daily_reviews', job: { label: 'Daily Reviews', spec: DAILY_REVIEWS_SPEC, rows: records.dailyReviews } },
    // Inspections also render a roster table here (the PDF is the full form).
    { key: 'inspections', job: { label: 'Inspections', spec: INSPECTIONS_SPEC, rows: records.inspections } },
    // Civilian multi-kind — empty on military, so they self-omit.
    { key: 'sms', job: { label: 'SMS — Hazards', spec: SMS_HAZARDS_SPEC, rows: records.sms.hazards } },
    { key: 'sms', job: { label: 'SMS — Mitigations', spec: SMS_MITIGATIONS_SPEC, rows: records.sms.mitigations } },
    { key: 'sms', job: { label: 'SMS — Audits', spec: SMS_AUDITS_SPEC, rows: records.sms.audits } },
    { key: 'sms', job: { label: 'SMS — MoC', spec: SMS_MOC_SPEC, rows: records.sms.mocs } },
    { key: 'sms', job: { label: 'SMS — Safety Reports', spec: SMS_SAFETY_REPORTS_SPEC, rows: records.sms.safetyReports } },
    { key: 'aep', job: { label: 'AEP — Plans', spec: AEP_PLANS_SPEC, rows: records.aep.plans } },
    { key: 'aep', job: { label: 'AEP — Response Agencies', spec: AEP_AGENCIES_SPEC, rows: records.aep.agencies } },
    { key: 'aep', job: { label: 'AEP — Drills', spec: AEP_DRILLS_SPEC, rows: records.aep.drills } },
    { key: 'aep', job: { label: 'AEP — Comms Checks', spec: AEP_COMMS_CHECKS_SPEC, rows: records.aep.commsChecks } },
  ]
  for (const { key, job } of tableJobs) {
    if (!sel.has(key)) continue
    const mod = specToModule(job.label, job.spec, job.rows, period)
    if (mod.rows.length > 0) modules.push(mod)
  }

  // Events Log — already pre-formatted; filter on createdAt.
  if (sel.has('events_log')) {
    const rows = records.eventsLog
      .filter((r) => isInRange(r.createdAt, period))
      .map((r) => [r.createdAt.slice(0, 10), r.createdAt.slice(11, 16) + 'Z', r.action, r.details, r.oi, r.user])
    if (rows.length > 0) modules.push({ key: 'events_log', label: 'Events Log', columns: ['Date', 'Time', 'Action', 'Details', 'OI', 'User'], rows })
  }

  // PDF-only modules: list with counts + a pointer to documents/.
  const documents: ViewerDocRef[] = []
  const docRef = (key: string, label: string, folder: string, count: number) => {
    if (sel.has(key) && count > 0) documents.push({ label, count, folder })
  }
  docRef('ppr', 'PPR', 'PPR', records.ppr.entries.filter((e) => isInRange(e.arrival_date, period)).length)
  docRef('scn', 'SCN Tests', 'SCN', records.scn.checks.filter((c) => isInRange(c.check_date, period)).length)
  docRef('waivers', 'Waivers', 'Waivers', records.waivers.waivers.filter((w) => isInRange(w.created_at, period)).length)
  docRef('acsi', 'ACSI', 'ACSI', records.acsi.filter((i) => isInRange(i.created_at, period)).length)
  docRef('training_part139', 'Training', 'Training', records.training.length)

  return { base: opts.base, period, generatedAt: opts.generatedAt, modules, documents }
}

/** Build the viewer/ ExportFiles. The dataset is inlined into data.js. */
export function buildViewerFiles(data: ViewerDataset): ExportFile[] {
  const enc = (s: string) => new TextEncoder().encode(s)
  return [
    { path: 'viewer/index.html', bytes: enc(VIEWER_HTML) },
    { path: 'viewer/styles.css', bytes: enc(VIEWER_CSS) },
    { path: 'viewer/app.js', bytes: enc(VIEWER_JS) },
    { path: 'viewer/data.js', bytes: enc(viewerDataJs(data)) },
  ]
}

/** Inline the dataset safely: escape `<` so a record value can't close the script tag. */
export function viewerDataJs(data: ViewerDataset): string {
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  return `window.__GLIDEPATH_EXPORT__ = ${json};\n`
}

const VIEWER_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Glidepath Records Export</title>
<link rel="stylesheet" href="styles.css" />
</head>
<body>
<header>
  <div id="title">Glidepath Records Export</div>
  <div id="subtitle"></div>
  <button id="printBtn" type="button">Print this view</button>
</header>
<div id="layout">
  <nav id="nav"></nav>
  <main id="main">
    <div id="toolbar"><input id="search" type="search" placeholder="Search this table…" /></div>
    <div id="tableWrap"></div>
  </main>
</div>
<script src="data.js"></script>
<script src="app.js"></script>
</body>
</html>
`

const VIEWER_CSS = `* { box-sizing: border-box; }
body { margin: 0; font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #1e293b; background: #f8fafc; }
header { padding: 14px 18px; background: #0f172a; color: #fff; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
#title { font-size: 18px; font-weight: 800; }
#subtitle { font-size: 13px; color: #cbd5e1; flex: 1; }
#printBtn { background: #0369a1; color: #fff; border: none; border-radius: 6px; padding: 8px 14px; font-weight: 700; cursor: pointer; }
#layout { display: flex; min-height: calc(100vh - 56px); }
#nav { width: 240px; background: #fff; border-right: 1px solid #e2e8f0; padding: 10px; overflow-y: auto; }
#nav .grp { font-size: 11px; font-weight: 700; letter-spacing: .06em; color: #94a3b8; margin: 12px 6px 4px; }
#nav button { display: flex; justify-content: space-between; width: 100%; text-align: left; background: none; border: none; padding: 8px 10px; border-radius: 6px; cursor: pointer; font-size: 13px; color: #334155; }
#nav button.active { background: rgba(3,105,161,.1); color: #0369a1; font-weight: 700; }
#nav button .count { color: #94a3b8; font-weight: 600; }
#nav a { display: flex; justify-content: space-between; text-decoration: none; padding: 8px 10px; border-radius: 6px; font-size: 13px; color: #334155; }
#nav a .count { color: #94a3b8; }
#main { flex: 1; padding: 16px 18px; overflow-x: auto; }
#toolbar { margin-bottom: 12px; }
#search { width: 100%; max-width: 420px; padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; }
table { border-collapse: collapse; width: 100%; background: #fff; font-size: 13px; }
th, td { border: 1px solid #e2e8f0; padding: 6px 9px; text-align: left; vertical-align: top; }
th { background: #1e293b; color: #fff; position: sticky; top: 0; cursor: pointer; white-space: nowrap; }
tr:nth-child(even) td { background: #f8fafc; }
#empty { color: #64748b; padding: 20px 4px; }
.rowcount { color: #64748b; font-size: 12px; margin-bottom: 8px; }
@media print {
  header #printBtn, #nav, #toolbar { display: none; }
  #layout { display: block; }
  th { position: static; }
}
`

const VIEWER_JS = `(function () {
  var data = window.__GLIDEPATH_EXPORT__ || { modules: [], documents: [] };
  var nav = document.getElementById('nav');
  var tableWrap = document.getElementById('tableWrap');
  var search = document.getElementById('search');
  var subtitle = document.getElementById('subtitle');
  var active = data.modules.length ? 0 : -1;
  var sortCol = -1, sortDir = 1;

  function periodLabel(p) {
    if (!p) return '';
    if (p.kind === 'all_time') return 'All time';
    return (p.from || '…') + ' to ' + (p.to || '…');
  }
  var base = data.base || {};
  subtitle.textContent = (base.name || 'Unknown') + (base.icao ? ' (' + base.icao + ')' : '') +
    '  ·  ' + periodLabel(data.period) + (data.generatedAt ? '  ·  generated ' + data.generatedAt.slice(0, 10) : '');

  function renderNav() {
    nav.innerHTML = '';
    if (data.modules.length) {
      var g1 = document.createElement('div'); g1.className = 'grp'; g1.textContent = 'BROWSE'; nav.appendChild(g1);
      data.modules.forEach(function (m, i) {
        var b = document.createElement('button');
        if (i === active) b.className = 'active';
        b.innerHTML = '<span></span><span class="count"></span>';
        b.children[0].textContent = m.label;
        b.children[1].textContent = m.rows.length;
        b.onclick = function () { active = i; sortCol = -1; search.value = ''; render(); };
        nav.appendChild(b);
      });
    }
    if (data.documents && data.documents.length) {
      var g2 = document.createElement('div'); g2.className = 'grp'; g2.textContent = 'DOCUMENTS (PDF)'; nav.appendChild(g2);
      data.documents.forEach(function (d) {
        var a = document.createElement('a');
        a.href = '../documents/' + d.folder;
        a.innerHTML = '<span></span><span class="count"></span>';
        a.children[0].textContent = d.label;
        a.children[1].textContent = d.count;
        nav.appendChild(a);
      });
    }
  }

  function renderTable() {
    if (active < 0) { tableWrap.innerHTML = '<div id="empty">No browsable records in this export.</div>'; return; }
    var m = data.modules[active];
    var q = (search.value || '').toLowerCase();
    var rows = q ? m.rows.filter(function (r) { return r.join(' ').toLowerCase().indexOf(q) !== -1; }) : m.rows.slice();
    if (sortCol >= 0) {
      rows.sort(function (a, b) {
        var x = (a[sortCol] || ''), y = (b[sortCol] || '');
        return x < y ? -sortDir : x > y ? sortDir : 0;
      });
    }
    var html = '<div class="rowcount">' + rows.length + ' of ' + m.rows.length + ' row(s)</div><table><thead><tr>';
    m.columns.forEach(function (c, ci) { html += '<th data-c="' + ci + '">' + esc(c) + '</th>'; });
    html += '</tr></thead><tbody>';
    rows.forEach(function (r) {
      html += '<tr>';
      r.forEach(function (cell) { html += '<td>' + esc(cell) + '</td>'; });
      html += '</tr>';
    });
    html += '</tbody></table>';
    tableWrap.innerHTML = html;
    var ths = tableWrap.querySelectorAll('th');
    for (var i = 0; i < ths.length; i++) {
      ths[i].onclick = function () {
        var c = parseInt(this.getAttribute('data-c'), 10);
        if (sortCol === c) sortDir = -sortDir; else { sortCol = c; sortDir = 1; }
        renderTable();
      };
    }
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function render() { renderNav(); renderTable(); }
  search.oninput = renderTable;
  document.getElementById('printBtn').onclick = function () { window.print(); };
  render();
})();
`
