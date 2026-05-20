/* global React */
// Reports tab — NAMT/AFM only.
// Unit-wide roll-ups computed live from state.members + org catalogs.
// Sub-tabbed: Overview, Roll-up, Overdue, 1098 & RAT, Formal, 797, Quals/SEI, Member Print.

const { useState: useStateReports, useMemo: useMemoReports } = React;

/* =====================================================================
   Metric computation — pure functions over state
   ===================================================================== */

function reportsParseDate(s) {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const dt = new Date(parseInt(m[1],10), parseInt(m[2],10)-1, parseInt(m[3],10));
  dt.setHours(0,0,0,0);
  return dt;
}
function reportsTodayMs() { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); }
function reportsDaysFromToday(dateStr) {
  const d = reportsParseDate(dateStr);
  if (!d) return null;
  return Math.round((d.getTime() - reportsTodayMs()) / 86400000);
}

// ---- Date-range filter helpers --------------------------------------
// filter shape: { mode: 'all'|'year'|'quarter'|'custom', year, quarter, from, to }
function reportsResolveDateRange(filter) {
  if (!filter || filter.mode === 'all') return null;
  const y = parseInt(filter.year, 10);
  if (filter.mode === 'year' && y) {
    return { from: `${y}-01-01`, to: `${y}-12-31`, label: `${y}` };
  }
  if (filter.mode === 'quarter' && y && filter.quarter) {
    const ranges = {
      Q1: [`${y}-01-01`, `${y}-03-31`],
      Q2: [`${y}-04-01`, `${y}-06-30`],
      Q3: [`${y}-07-01`, `${y}-09-30`],
      Q4: [`${y}-10-01`, `${y}-12-31`],
    };
    const r = ranges[filter.quarter];
    if (!r) return null;
    return { from: r[0], to: r[1], label: `${filter.quarter} ${y}` };
  }
  if (filter.mode === 'custom') {
    const from = filter.from || '';
    const to = filter.to || '';
    if (!from && !to) return null;
    const label = from && to ? `${from} → ${to}` : (from ? `from ${from}` : `through ${to}`);
    return { from: from || '0000-01-01', to: to || '9999-12-31', label };
  }
  return null;
}
function reportsInRange(dateStr, range) {
  if (!range) return true;
  if (!dateStr) return false;
  return dateStr >= range.from && dateStr <= range.to;
}

// Skill level from DAFSC e.g. "1C751" → "5"
function reportsSkillFromDafsc(dafsc) {
  const m = /^1C7([0-9])1$/i.exec((dafsc || '').trim());
  return m ? m[1] : '';
}

// Status badge string (Trainee/Trainer/Certifier/AFM) — uses cover.status + qualifications.yesNo
function reportsMemberStatus(m) {
  const cover = m.cover || {};
  if (cover.status) return cover.status;
  const yn = (m.qualifications && m.qualifications.yesNo) || [];
  const yes = (label) => yn.find(q => q.name === label && q.value === 'Yes');
  if (yes('Certifier')) return 'Certifier';
  if (yes('Trainer'))   return 'Trainer';
  return 'Trainee';
}

// JQS roll-up
function reportsJqsRoll(m, jqsCatalog) {
  const cat = jqsCatalog || [];
  const items = cat.filter(c => c.kind === 'item');
  const required = items.filter(c => c.required);
  const progress = m.jqsProgress || {};
  const completed = items.filter(c => {
    const p = progress[c.number];
    return p && p.complete;
  });
  const requiredCompleted = required.filter(c => {
    const p = progress[c.number];
    return p && p.complete;
  });
  const pct = items.length ? Math.round(completed.length / items.length * 100) : 0;
  const reqPct = required.length ? Math.round(requiredCompleted.length / required.length * 100) : 100;
  return {
    total: items.length, completed: completed.length, pct,
    requiredTotal: required.length, requiredCompleted: requiredCompleted.length, requiredPct: reqPct,
  };
}

// 1098 roll-up — uses rt1098Status from tab-1098.jsx (global)
function reportsRt1098Roll(m, rt1098) {
  const tasks = (rt1098 && rt1098.tasks) || [];
  const year = (rt1098 && rt1098.currentYear) || ((rt1098 && rt1098.years && rt1098.years[0]) || String(new Date().getFullYear()));
  const progressYear = (m.daf1098Progress && m.daf1098Progress[year]) || {};
  let required = 0, complete = 0, due = 0, over = 0;
  const dueItems = [], overItems = [];
  for (const t of tasks) {
    required++;
    const p = progressYear[t.id];
    const status = window.rt1098Status ? window.rt1098Status(p) : '';
    if (status === 'Complete') complete++;
    else if (status === 'Due Soon') { due++; dueItems.push({ task: t.task, due: p?.nextDue }); }
    else if (status === 'Overdue')  { over++; overItems.push({ task: t.task, due: p?.nextDue }); }
  }
  return { required, complete, due, over, dueItems, overItems, year };
}

// RAT does not apply to Civilians, Contractors, or Separated members.
const REPORTS_RAT_EXEMPT_STATUSES = ["Civilian", "Contractor", "Separated"];
function reportsIsRatExempt(m) {
  return REPORTS_RAT_EXEMPT_STATUSES.includes((m.cover && m.cover.status) || "");
}

// RAT roll-up — uses ratStatus from tab-rat.jsx (global)
function reportsRatRoll(m) {
  if (reportsIsRatExempt(m)) {
    return { required: 0, complete: 0, due: 0, over: 0, dueItems: [], overItems: [], exempt: true };
  }
  const items = (m.rat && m.rat.items) || [];
  let required = 0, complete = 0, due = 0, over = 0;
  const dueItems = [], overItems = [];
  for (const it of items) {
    required++;
    const s = window.ratStatus ? window.ratStatus(it) : '';
    if (s === 'Complete') complete++;
    else if (s === 'Due Soon') { due++; dueItems.push({ task: it.course || '(untitled)', due: it.due }); }
    else if (s === 'Overdue')  { over++; overItems.push({ task: it.course || '(untitled)', due: it.due }); }
  }
  return { required, complete, due, over, dueItems, overItems };
}

// Formal training roll-up
function reportsFormalRoll(m, formalCatalog) {
  const sections = ['haf', 'initial', 'continuation'];
  const cat = formalCatalog || { haf:[], initial:[], continuation:[] };
  const progress = m.formalTrainingProgress || {};
  const out = {};
  let totalAll = 0, doneAll = 0;
  for (const s of sections) {
    const sectionCat = cat[s] || [];
    const total = sectionCat.length;
    let done = 0;
    for (const entry of sectionCat) {
      const key = entry.id || entry.course;
      const p = progress[key];
      if (p && (p.completionDate || p.complete || p.dateCompleted)) done++;
    }
    out[s] = { total, done };
    totalAll += total; doneAll += done;
  }
  out.total = totalAll;
  out.done = doneAll;
  out.pct = totalAll ? Math.round(doneAll / totalAll * 100) : 0;
  return out;
}

// Quals / SEI flags from member.qualifications.yesNo
function reportsQuals(m) {
  const yn = (m.qualifications && m.qualifications.yesNo) || [];
  const has = (name) => !!yn.find(q => q.name === name && q.value === 'Yes');
  const qtps = (m.qualifications && m.qualifications.qtps) || [];
  const qtpComplete = (name) => {
    const q = qtps.find(x => (x.name || '').toLowerCase().includes(name.toLowerCase()));
    return !!(q && q.completeDate);
  };
  return {
    '5L':  qtpComplete('5-Level'),
    '7L':  qtpComplete('7-Level'),
    'AMSL': qtpComplete('Airfield Manager Position') || qtpComplete('AMSL'),
    'AFM': qtpComplete('Airfield Manager'),
    '155': has('SEI 155'),
    '368': has('SEI 368'),
    '090': has('SEI 090'),
    '3LZ': has('SEI 3LZ'),
    'trainer':   has('Trainer'),
    'certifier': has('Certifier'),
  };
}

// Recent 797 entries across members (flattened, latest first)
// `range` (optional) filters by completeDate || startDate.
function reportsRecent797(members, limit, range) {
  const all = [];
  for (const m of members) {
    const entries = m.daf797 || [];
    for (const e of entries) {
      const d = e.completeDate || e.startDate;
      if (!d) continue;
      if (range && !reportsInRange(d, range)) continue;
      all.push({
        date: d,
        member: m.cover.fullName || '(unnamed)',
        memberId: m.id,
        task: e.task || '(untitled)',
        trainer: e.trainerInitials || '',
        certifier: e.certifierInitials || '',
        type: e.completeDate ? (e.certifierInitials ? 'Cert' : 'Sign-off') : 'Initial',
      });
    }
  }
  all.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return all.slice(0, limit || 20);
}

// Per-member roll-up record
function reportsRollupMember(m, ctx) {
  const jqs = reportsJqsRoll(m, ctx.jqsCatalog);
  const t1098 = reportsRt1098Roll(m, ctx.rt1098);
  const rat = reportsRatRoll(m);
  const formal = reportsFormalRoll(m, ctx.formalCatalog);
  const overdue = t1098.over + rat.over;
  const dueSoon = t1098.due + rat.due;
  return {
    id: m.id,
    name: m.cover.fullName || '(unnamed)',
    grade: m.cover.grade || '',
    skill: reportsSkillFromDafsc(m.cover.dafsc),
    status: reportsMemberStatus(m),
    unit: m.cover.unit || '',
    ratExempt: reportsIsRatExempt(m),
    jqs, t1098, rat, formal,
    overdueCount: overdue,
    dueSoonCount: dueSoon,
    overdueItems: [
      ...t1098.overItems.map(o => ({ ...o, source: 'daf1098' })),
      ...rat.overItems.map(o => ({ ...o, source: 'rat' })),
    ],
    dueSoonItems: [
      ...t1098.dueItems.map(o => ({ ...o, source: 'daf1098' })),
      ...rat.dueItems.map(o => ({ ...o, source: 'rat' })),
    ],
  };
}

/* =====================================================================
   UI primitives
   ===================================================================== */

function ReportsMiniBar({ pct, tone }) {
  const t = tone || (pct >= 90 ? 'ok' : pct >= 60 ? 'warn' : 'bad');
  return (
    <div className="rpt-mini-bar">
      <div className={'rpt-mini-bar-fill rpt-tone-' + t} style={{ width: pct + '%' }}></div>
      <span className="rpt-mini-bar-pct">{pct}%</span>
    </div>
  );
}

function ReportsPill({ tone, children }) {
  return <span className={'rpt-pill rpt-tone-' + tone}>{children}</span>;
}

const REPORTS_QUARTERS = [
  { key: 'Q1', label: 'Q1 · Jan–Mar' },
  { key: 'Q2', label: 'Q2 · Apr–Jun' },
  { key: 'Q3', label: 'Q3 · Jul–Sep' },
  { key: 'Q4', label: 'Q4 · Oct–Dec' },
];

function ReportsDateFilter({ filter, setFilter, range }) {
  const thisYear = new Date().getFullYear();
  const years = [thisYear - 2, thisYear - 1, thisYear, thisYear + 1];
  const set = (patch) => setFilter({ ...filter, ...patch });
  const modes = [
    { k: 'all',     label: 'All time' },
    { k: 'year',    label: 'Year' },
    { k: 'quarter', label: 'Quarter' },
    { k: 'custom',  label: 'Custom' },
  ];
  return (
    <div className="rpt-datefilter">
      <div className="rpt-datefilter-label">Date range</div>
      <div className="rpt-datefilter-modes">
        {modes.map(o => (
          <button key={o.k}
                  type="button"
                  className={'rpt-datefilter-mode' + (filter.mode === o.k ? ' active' : '')}
                  onClick={() => set({ mode: o.k })}>{o.label}</button>
        ))}
      </div>
      {(filter.mode === 'year' || filter.mode === 'quarter') && (
        <div className="rpt-datefilter-controls">
          <label className="rpt-datefilter-field">
            <span>Year</span>
            <select value={filter.year} onChange={e => set({ year: e.target.value })}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          {filter.mode === 'quarter' && (
            <label className="rpt-datefilter-field">
              <span>Quarter</span>
              <select value={filter.quarter} onChange={e => set({ quarter: e.target.value })}>
                {REPORTS_QUARTERS.map(q => <option key={q.key} value={q.key}>{q.label}</option>)}
              </select>
            </label>
          )}
        </div>
      )}
      {filter.mode === 'custom' && (
        <div className="rpt-datefilter-controls">
          <label className="rpt-datefilter-field">
            <span>From</span>
            <input type="date" value={filter.from || ''} onChange={e => set({ from: e.target.value })} />
          </label>
          <label className="rpt-datefilter-field">
            <span>To</span>
            <input type="date" value={filter.to || ''} onChange={e => set({ to: e.target.value })} />
          </label>
        </div>
      )}
      <div className="rpt-datefilter-summary">
        {range
          ? <><strong>Active:</strong> {range.label}</>
          : <span className="muted">No date filter · showing all activity</span>}
      </div>
    </div>
  );
}

const REPORTS_SUBNAV = [
  { key: 'overview', label: 'Overview' },
  { key: 'rollup',   label: 'Unit Roll-up' },
  { key: 'overdue',  label: 'Overdue / Due Soon' },
  { key: 'recur',    label: '1098 & RAT' },
  { key: 'formal',   label: 'Formal Training' },
  { key: 's797',     label: '797 Activity' },
  { key: 'quals',    label: 'Quals & SEI' },
  { key: 'print',    label: 'Member Print' },
];

const REPORTS_QUAL_COLS = [
  { key: '5L',  label: '5L QTP' },
  { key: '7L',  label: '7L QTP' },
  { key: 'AMSL',label: 'AMSL PCG' },
  { key: 'AFM', label: 'AFM PCG' },
  { key: '155', label: 'SEI 155' },
  { key: '368', label: 'SEI 368' },
  { key: '090', label: 'SEI 090' },
  { key: '3LZ', label: 'SEI 3LZ' },
];

/* =====================================================================
   Sub-panels
   ===================================================================== */

function ReportsKpiRow({ rollups }) {
  const totalMembers = rollups.length;
  const totalReq    = rollups.reduce((s, r) => s + r.t1098.required + r.rat.required, 0);
  const totalDone   = rollups.reduce((s, r) => s + r.t1098.complete + r.rat.complete, 0);
  const totalDue    = rollups.reduce((s, r) => s + r.dueSoonCount, 0);
  const totalOver   = rollups.reduce((s, r) => s + r.overdueCount, 0);
  return (
    <div className="metric-grid metric-grid-5">
      <div className="metric"><div className="lbl">Members</div><div className="val">{totalMembers}</div></div>
      <div className="metric"><div className="lbl">Required Tasks</div><div className="val">{totalReq}</div></div>
      <div className="metric ok"><div className="lbl">Complete</div><div className="val">{totalDone}</div></div>
      <div className="metric warn"><div className="lbl">Due Soon (30d)</div><div className="val">{totalDue}</div></div>
      <div className="metric bad"><div className="lbl">Overdue</div><div className="val">{totalOver}</div></div>
    </div>
  );
}

function ReportsRollupTable({ rollups, goToMember }) {
  if (!rollups.length) return <Empty title="No members" sub="Add members to populate the unit roll-up." />;
  return (
    <table className="tbl tbl-fit rpt-rollup">
      <thead>
        <tr>
          <th style={{ width: 200 }}>Member</th>
          <th style={{ width: 60 }}>Grade</th>
          <th style={{ width: 50 }}>Skill</th>
          <th style={{ width: 105 }}>Status</th>
          <th>JQS-CFETP</th>
          <th>Formal Tng</th>
          <th style={{ width: 80 }}>1098/RAT</th>
          <th style={{ width: 26 }}></th>
        </tr>
      </thead>
      <tbody>
        {rollups.map(r => {
          const cls = r.overdueCount ? 'row-overdue' : r.dueSoonCount ? 'row-warn' : '';
          return (
            <tr key={r.id} className={cls + ' rpt-row-link'} onClick={() => goToMember(r.id, 'cover')} title="Open this member's record">
              <td><span className="rpt-name">{r.name}</span></td>
              <td className="mono small">{r.grade}</td>
              <td className="mono small">{r.skill || '—'}</td>
              <td><span className="rpt-status">{r.status}</span></td>
              <td><ReportsMiniBar pct={r.jqs.pct} /></td>
              <td><ReportsMiniBar pct={r.formal.pct} /></td>
              <td>
                {r.overdueCount > 0 && <ReportsPill tone="bad">{r.overdueCount} over</ReportsPill>}
                {r.overdueCount === 0 && r.dueSoonCount > 0 && <ReportsPill tone="warn">{r.dueSoonCount} due</ReportsPill>}
                {r.overdueCount === 0 && r.dueSoonCount === 0 && <ReportsPill tone="ok">✓</ReportsPill>}
              </td>
              <td className="rpt-link-arrow">›</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ReportsOverdueList({ rollups, goToMember, limit }) {
  // Flatten all overdue + due-soon across unit
  const flat = [];
  for (const r of rollups) {
    for (const it of r.overdueItems) flat.push({ ...it, severity: 'overdue', member: r.name, memberId: r.id, days: reportsDaysFromToday(it.due) });
    for (const it of r.dueSoonItems) flat.push({ ...it, severity: 'due-soon', member: r.name, memberId: r.id, days: reportsDaysFromToday(it.due) });
  }
  flat.sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999));
  const rows = limit ? flat.slice(0, limit) : flat;
  if (!rows.length) return <Empty title="Nothing flagged" sub="No overdue or due-soon items across the unit." />;
  const sourceLabel = (s) => s === 'daf1098' ? 'DAF 1098' : s === 'rat' ? 'RAT' : s;
  const sourceTab = (s) => s === 'daf1098' ? 'daf1098' : s === 'rat' ? 'rat' : 'cover';
  return (
    <table className="tbl tbl-fit">
      <thead>
        <tr>
          <th style={{ width: 100 }}>Due</th>
          <th style={{ width: 60 }}>Δ days</th>
          <th style={{ width: 200 }}>Member</th>
          <th>Task</th>
          <th style={{ width: 90 }}>Source</th>
          <th style={{ width: 90 }}>Status</th>
          <th style={{ width: 26 }}></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((d, i) => {
          const cls = d.severity === 'overdue' ? 'row-overdue' : 'row-warn';
          return (
            <tr key={i} className={cls + ' rpt-row-link'} onClick={() => goToMember(d.memberId, sourceTab(d.source))} title="Open this member's record">
              <td className="mono small">{d.due || '—'}</td>
              <td className="mono small">{d.days == null ? '—' : (d.days < 0 ? d.days : '+' + d.days)}</td>
              <td><span className="rpt-name">{d.member}</span></td>
              <td>{d.task}</td>
              <td><span className="chip">{sourceLabel(d.source)}</span></td>
              <td>{d.severity === 'overdue' ? <ReportsPill tone="bad">Overdue</ReportsPill> : <ReportsPill tone="warn">Due Soon</ReportsPill>}</td>
              <td className="rpt-link-arrow">›</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ReportsRecurringTable({ rollups, source }) {
  // source = 'daf1098' | 'rat'. Aggregate per-task across all members.
  // For RAT, Civilian/Contractor/Separated members don't have RAT requirements,
  // so exclude them from the denominator and from due/over tallies.
  const relevantRollups = source === 'rat'
    ? rollups.filter(r => !r.ratExempt)
    : rollups;
  const taskMap = new Map();
  for (const r of relevantRollups) {
    const items = source === 'daf1098'
      ? [...r.t1098.dueItems.map(x => ({ ...x, state: 'due' })), ...r.t1098.overItems.map(x => ({ ...x, state: 'over' }))]
      : [...r.rat.dueItems.map(x => ({ ...x, state: 'due' })), ...r.rat.overItems.map(x => ({ ...x, state: 'over' }))];
    for (const it of items) {
      const key = it.task;
      if (!taskMap.has(key)) taskMap.set(key, { task: key, req: 0, comp: 0, due: 0, over: 0 });
      const row = taskMap.get(key);
      if (it.state === 'due') row.due++; else row.over++;
    }
  }
  // Required = #members; complete = required - due - over
  const totalMembers = relevantRollups.length;
  // Pull all task names from the org catalog so 100%-clean tasks still show up
  let allTaskNames = [];
  if (source === 'daf1098') {
    const tasks = (rollups[0]?.t1098 && rollups[0].t1098.tasks) || [];
    // We didn't keep tasks on the rollup — derive from anywhere we can
    // Build from any state passed via window if available; fall back to taskMap keys
    allTaskNames = Array.from(new Set([...taskMap.keys()]));
  } else {
    // RAT items vary by member; show only items that have any over/due in the unit, plus track totals
    allTaskNames = Array.from(new Set([...taskMap.keys()]));
  }
  // For each task: compute the count of members where this task is required (we count members who have it tracked)
  for (const [key, row] of taskMap) {
    row.req = totalMembers; // assume all members have this recurring task
    row.comp = Math.max(0, row.req - row.due - row.over);
  }
  const rows = Array.from(taskMap.values()).sort((a, b) => (b.over - a.over) || (b.due - a.due) || a.task.localeCompare(b.task));
  if (!rows.length) return <Empty title="No issues" sub={`All ${source === 'daf1098' ? '1098' : 'RAT'} tasks across the unit are current.`} />;
  return (
    <table className="tbl tbl-fit">
      <thead>
        <tr>
          <th>Task</th>
          <th style={{ width: 80 }}>Required</th>
          <th style={{ width: 80 }}>Complete</th>
          <th style={{ width: 80 }}>Due Soon</th>
          <th style={{ width: 80 }}>Overdue</th>
          <th style={{ width: 150 }}>Compliance</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(t => {
          const pct = t.req ? Math.round(t.comp / t.req * 100) : 0;
          const tone = t.over > 0 ? 'bad' : t.due > 0 ? 'warn' : 'ok';
          return (
            <tr key={t.task}>
              <td>{t.task}</td>
              <td className="mono small">{t.req}</td>
              <td className="mono small">{t.comp}</td>
              <td className="mono small">{t.due || '—'}</td>
              <td className="mono small">{t.over || '—'}</td>
              <td><ReportsMiniBar pct={pct} tone={tone} /></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ReportsFormalTable({ rollups, goToMember }) {
  return (
    <table className="tbl tbl-fit">
      <thead>
        <tr>
          <th style={{ width: 200 }}>Member</th>
          <th>HAF Required</th>
          <th>Initial Quals</th>
          <th>Continuation</th>
          <th style={{ width: 150 }}>Overall</th>
        </tr>
      </thead>
      <tbody>
        {rollups.map(r => (
          <tr key={r.id} className="rpt-row-link" onClick={() => goToMember(r.id, 'formal')}>
            <td><span className="rpt-name">{r.name}</span></td>
            <td className="mono small">{r.formal.haf.done}/{r.formal.haf.total}</td>
            <td className="mono small">{r.formal.initial.done}/{r.formal.initial.total}</td>
            <td className="mono small">{r.formal.continuation.done}/{r.formal.continuation.total}</td>
            <td><ReportsMiniBar pct={r.formal.pct} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ReportsQualMatrix({ members, goToMember }) {
  return (
    <table className="tbl tbl-fit rpt-matrix">
      <thead>
        <tr>
          <th style={{ width: 200 }}>Member</th>
          {REPORTS_QUAL_COLS.map(c => <th key={c.key} style={{ width: 80 }}>{c.label}</th>)}
        </tr>
      </thead>
      <tbody>
        {members.map(m => {
          const q = reportsQuals(m);
          return (
            <tr key={m.id} className="rpt-row-link" onClick={() => goToMember(m.id, 'qualifications')}>
              <td><span className="rpt-name">{m.cover.fullName || '(unnamed)'}</span></td>
              {REPORTS_QUAL_COLS.map(c => (
                <td key={c.key} className="rpt-matrix-cell">
                  <span className={'rpt-tick ' + (q[c.key] ? 'rpt-tick-on' : 'rpt-tick-off')}>{q[c.key] ? '●' : '○'}</span>
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ReportsRecent797Table({ entries, goToMember }) {
  if (!entries.length) return <Empty title="No recent activity" sub="No DAF 797 entries with dates yet." />;
  return (
    <table className="tbl tbl-fit">
      <thead>
        <tr>
          <th style={{ width: 100 }}>Date</th>
          <th style={{ width: 200 }}>Member</th>
          <th>Task</th>
          <th style={{ width: 100 }}>Trainer</th>
          <th style={{ width: 100 }}>Action</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((r, i) => (
          <tr key={i} className="rpt-row-link" onClick={() => goToMember(r.memberId, 'daf797')}>
            <td className="mono small">{r.date}</td>
            <td><span className="rpt-name">{r.member}</span></td>
            <td>{r.task}</td>
            <td className="mono small">{r.trainer || '—'}</td>
            <td><span className="chip">{r.type}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ReportsMemberPrint({ rollups, members, jqsCatalog, formalCatalog, goToMember }) {
  const [selectedId, setSelectedId] = useStateReports(rollups[0]?.id || '');
  const r = rollups.find(x => x.id === selectedId) || rollups[0];
  const m = members.find(x => x.id === (r ? r.id : null));
  if (!r || !m) return <Empty title="No member" sub="Add a member to print a summary." />;
  const out = [...r.overdueItems.map(o => ({ ...o, sev: 'overdue' })), ...r.dueSoonItems.map(o => ({ ...o, sev: 'due' }))];
  return (
    <Card title="Export-Ready Member Summary" sub="Single-page printable record snapshot"
      action={
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <select className="rpt-select" value={selectedId} onChange={(e)=>setSelectedId(e.target.value)}>
            {rollups.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          <button className="btn" onClick={() => goToMember(r.id, 'cover')}>Open record</button>
          <button className="btn primary" onClick={() => window.print()}>⎙ Print</button>
        </div>
      }
    >
      <div className="rpt-print">
        <div className="rpt-print-head">
          <div>
            <div className="rpt-print-name">{r.name || '(unnamed)'}</div>
            <div className="rpt-print-meta">
              {[r.grade, m.cover.dafsc, r.status, m.cover.unit].filter(Boolean).join(' · ')}
              <br/>Generated {new Date().toLocaleDateString()}
            </div>
          </div>
          <div className="rpt-print-seal">AMTR</div>
        </div>

        <div className="rpt-print-grid">
          <div className="rpt-print-box">
            <div className="rpt-print-box-lbl">JQS-CFETP</div>
            <div className="rpt-print-box-val">{r.jqs.completed} / {r.jqs.total}</div>
            <ReportsMiniBar pct={r.jqs.pct} />
            {r.jqs.requiredTotal > 0 && (
              <div className="rpt-print-box-sub">Required at installation: {r.jqs.requiredCompleted}/{r.jqs.requiredTotal}</div>
            )}
          </div>
          <div className="rpt-print-box">
            <div className="rpt-print-box-lbl">Formal Training</div>
            <div className="rpt-print-box-val">{r.formal.done} / {r.formal.total}</div>
            <ReportsMiniBar pct={r.formal.pct} />
          </div>
          <div className="rpt-print-box">
            <div className="rpt-print-box-lbl">Recurring (1098 + RAT)</div>
            <div className="rpt-print-box-val">
              {r.overdueCount === 0 && r.dueSoonCount === 0 ? 'Current' : `${r.overdueCount} over · ${r.dueSoonCount} due`}
            </div>
            <div className="rpt-print-status-row">
              {r.overdueCount > 0 && <ReportsPill tone="bad">{r.overdueCount} overdue</ReportsPill>}
              {r.dueSoonCount > 0 && <ReportsPill tone="warn">{r.dueSoonCount} due soon</ReportsPill>}
              {r.overdueCount === 0 && r.dueSoonCount === 0 && <ReportsPill tone="ok">All current</ReportsPill>}
            </div>
          </div>
          <div className="rpt-print-box">
            <div className="rpt-print-box-lbl">Qualifications</div>
            <div className="rpt-print-tags">
              {(() => {
                const q = reportsQuals(m);
                const awarded = Object.entries(q).filter(([k, v]) => v && !['trainer','certifier'].includes(k)).map(([k]) => k);
                if (!awarded.length) return <span className="rpt-muted">None awarded</span>;
                return awarded.map(k => <span key={k} className="chip">{k.length <= 3 ? 'SEI ' + k : k}</span>);
              })()}
            </div>
          </div>
        </div>

        <div className="rpt-print-section">
          <div className="rpt-print-section-title">Outstanding Items</div>
          {!out.length ? <div className="rpt-muted">None — member is current.</div> : (
            <table className="tbl tbl-fit">
              <thead><tr><th style={{ width: 100 }}>Due</th><th>Task</th><th style={{ width: 100 }}>Source</th><th style={{ width: 100 }}>Status</th></tr></thead>
              <tbody>
                {out.map((o, i) => (
                  <tr key={i} className={o.sev === 'overdue' ? 'row-overdue' : 'row-warn'}>
                    <td className="mono small">{o.due || '—'}</td>
                    <td>{o.task}</td>
                    <td><span className="chip">{o.source === 'daf1098' ? 'DAF 1098' : 'RAT'}</span></td>
                    <td>{o.sev === 'overdue' ? <ReportsPill tone="bad">Overdue</ReportsPill> : <ReportsPill tone="warn">Due Soon</ReportsPill>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rpt-print-sig">
          <div className="sig"><span className="name">Trainer:</span> _____________________________</div>
          <div className="sig"><span className="name">Certifier:</span> _____________________________</div>
          <div className="sig"><span className="name">AFM:</span> _____________________________</div>
        </div>
      </div>
    </Card>
  );
}

/* =====================================================================
   Overview panel
   ===================================================================== */

function ReportsOverview({ rollups, members, goto, goToMember, range }) {
  const flat = [];
  for (const r of rollups) {
    for (const it of r.overdueItems) flat.push({ ...it, severity: 'overdue', member: r.name, memberId: r.id });
    for (const it of r.dueSoonItems) flat.push({ ...it, severity: 'due-soon', member: r.name, memberId: r.id });
  }
  flat.sort((a, b) => (reportsDaysFromToday(a.due) ?? 9999) - (reportsDaysFromToday(b.due) ?? 9999));
  const lowJqs = [...rollups].sort((a, b) => a.jqs.pct - b.jqs.pct).slice(0, 5);
  const worstTasks = (() => {
    const m = new Map();
    for (const r of rollups) {
      for (const x of [...r.t1098.overItems, ...r.rat.overItems]) {
        m.set(x.task, (m.get(x.task) || 0) + 1);
      }
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  })();
  const recent = reportsRecent797(members, 5, range);
  const overdueCount = flat.filter(x => x.severity === 'overdue').length;
  const dueCount = flat.filter(x => x.severity === 'due-soon').length;
  return (
    <>
      <ReportsKpiRow rollups={rollups} />
      <div className="rpt-overview-grid">
        <Card flush
          title="Attention Required"
          sub={`${overdueCount} overdue · ${dueCount} due soon`}
          action={<button className="btn ghost small" onClick={() => goto('overdue')}>View all →</button>}
        >
          {flat.length === 0 ? <Empty title="All current" sub="No overdue or due-soon items across the unit." />
            : (
              <table className="tbl tbl-fit">
                <thead><tr><th style={{ width: 100 }}>Due</th><th style={{ width: 180 }}>Member</th><th>Task</th><th style={{ width: 80 }}>Status</th></tr></thead>
                <tbody>
                  {flat.slice(0, 5).map((d, i) => (
                    <tr key={i} className={(d.severity === 'overdue' ? 'row-overdue' : 'row-warn') + ' rpt-row-link'}
                        onClick={() => goToMember(d.memberId, d.source === 'rat' ? 'rat' : 'daf1098')}>
                      <td className="mono small">{d.due || '—'}</td>
                      <td><span className="rpt-name">{d.member}</span></td>
                      <td>{d.task}</td>
                      <td>{d.severity === 'overdue' ? <ReportsPill tone="bad">Over</ReportsPill> : <ReportsPill tone="warn">Due</ReportsPill>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </Card>

        <Card flush
          title="Lowest JQS Completion"
          sub="Members with the most remaining JQS items"
          action={<button className="btn ghost small" onClick={() => goto('rollup')}>View all →</button>}
        >
          {lowJqs.length === 0 ? <Empty title="No members" sub="" />
            : (
              <table className="tbl tbl-fit">
                <thead><tr><th style={{ width: 200 }}>Member</th><th style={{ width: 50 }}>Skill</th><th>Completion</th></tr></thead>
                <tbody>
                  {lowJqs.map(r => (
                    <tr key={r.id} className="rpt-row-link" onClick={() => goToMember(r.id, 'jqs')}>
                      <td><span className="rpt-name">{r.name}</span></td>
                      <td className="mono small">{r.skill || '—'}</td>
                      <td><ReportsMiniBar pct={r.jqs.pct} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </Card>

        <Card flush
          title="1098 & RAT — Worst Compliance"
          sub="Tasks with the most overdue across unit"
          action={<button className="btn ghost small" onClick={() => goto('recur')}>View all →</button>}
        >
          {worstTasks.length === 0 ? <Empty title="All clear" sub="No overdue recurring tasks." />
            : (
              <table className="tbl tbl-fit">
                <thead><tr><th>Task</th><th style={{ width: 60 }}>Over</th></tr></thead>
                <tbody>
                  {worstTasks.map(([task, count], i) => (
                    <tr key={i}>
                      <td>{task}</td>
                      <td className="mono small">{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </Card>

        <Card flush
          title="DAF 797 — Recent Activity"
          sub="Latest sign-offs across unit"
          action={<button className="btn ghost small" onClick={() => goto('s797')}>View all →</button>}
        >
          {recent.length === 0 ? <Empty title="No activity" sub="No dated DAF 797 entries yet." />
            : (
              <table className="tbl tbl-fit">
                <thead><tr><th style={{ width: 100 }}>Date</th><th style={{ width: 150 }}>Member</th><th>Task</th></tr></thead>
                <tbody>
                  {recent.map((r, i) => (
                    <tr key={i} className="rpt-row-link" onClick={() => goToMember(r.memberId, 'daf797')}>
                      <td className="mono small">{r.date}</td>
                      <td><span className="rpt-name">{r.member}</span></td>
                      <td>{r.task}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </Card>
      </div>
    </>
  );
}

/* =====================================================================
   Main TabReports
   ===================================================================== */

function TabReports({ state, role, goToMember }) {
  const [sub, setSub] = useStateReports('overview');
  const [filter, setFilter] = useStateReports(() => ({
    mode: 'all',
    year: new Date().getFullYear(),
    quarter: 'Q' + (Math.floor(new Date().getMonth() / 3) + 1),
    from: '',
    to: '',
  }));
  const range = useMemoReports(() => reportsResolveDateRange(filter), [filter]);
  const isAuthorized = role === 'namt' || role === 'afm';

  const rollups = useMemoReports(() => {
    const ctx = { jqsCatalog: state.jqsCatalog, rt1098: state.rt1098, formalCatalog: state.formalCatalog };
    return (state.members || []).map(m => reportsRollupMember(m, ctx));
  }, [state.members, state.jqsCatalog, state.rt1098, state.formalCatalog]);

  if (!isAuthorized) {
    return (
      <div>
        <PageHead crumb="Reports" title="Reports" formId="UNIT ROLL-UP" />
        <Empty title="Restricted view" sub="Reports are available to NAMT and AFM roles only. Use the role switcher in the top bar." />
      </div>
    );
  }

  return (
    <div>
      <PageHead
        crumb="Reports"
        title="Unit Roll-up"
        formId="NAMT / AFM REPORTS"
        action={<button className="btn" onClick={() => window.print()}>⎙ Print to PDF</button>}
      />

      <Card flush>
        <div className="subnav">
          {REPORTS_SUBNAV.map(t => (
            <button key={t.key} className={sub === t.key ? 'active' : ''} onClick={() => setSub(t.key)}>{t.label}</button>
          ))}
        </div>
      </Card>

      <ReportsDateFilter filter={filter} setFilter={setFilter} range={range} />

      <div style={{ marginTop: 14 }}>
        {sub === 'overview' && <ReportsOverview rollups={rollups} members={state.members || []} goto={setSub} goToMember={goToMember} range={range} />}
        {sub === 'rollup'   && (
          <Card flush title="Unit Readiness Roll-up" sub={`${rollups.length} members · click any row to open that record`}>
            <ReportsRollupTable rollups={rollups} goToMember={goToMember} />
          </Card>
        )}
        {sub === 'overdue'  && (
          <Card flush
            title="Overdue & Due Soon"
            sub={`${rollups.reduce((s,r)=>s+r.overdueCount,0)} overdue · ${rollups.reduce((s,r)=>s+r.dueSoonCount,0)} due within 30 days`}
          >
            <ReportsOverdueList rollups={rollups} goToMember={goToMember} />
          </Card>
        )}
        {sub === 'recur'    && (
          <>
            <Card flush title="DAF Form 1098 Compliance" sub="Per-task across the unit (current year)" style={{ marginBottom: 16 }}>
              <ReportsRecurringTable rollups={rollups} source="daf1098" />
            </Card>
            <Card flush title="Ready Airman Training Compliance" sub="Annual / triennial recurring requirements">
              <ReportsRecurringTable rollups={rollups} source="rat" />
            </Card>
          </>
        )}
        {sub === 'formal'   && (
          <Card flush title="Formal Training Status" sub="HAF / Initial / Continuation">
            <ReportsFormalTable rollups={rollups} goToMember={goToMember} />
          </Card>
        )}
        {sub === 's797'     && (
          <Card flush title="DAF Form 797 — Recent Task Log Activity" sub={range ? `Filtered to ${range.label} · latest first` : 'Cross-unit sign-offs, latest first'}>
            <ReportsRecent797Table entries={reportsRecent797(state.members || [], 50, range)} goToMember={goToMember} />
          </Card>
        )}
        {sub === 'quals'    && (
          <Card flush title="Qualifications & SEI Matrix" sub="● awarded · ○ not yet">
            <ReportsQualMatrix members={state.members || []} goToMember={goToMember} />
          </Card>
        )}
        {sub === 'print'    && (
          <ReportsMemberPrint
            rollups={rollups}
            members={state.members || []}
            jqsCatalog={state.jqsCatalog}
            formalCatalog={state.formalCatalog}
            goToMember={goToMember}
          />
        )}
      </div>
    </div>
  );
}

// Expose
window.TabReports = TabReports;
// Also expose helpers used by status functions in case other tabs import them
window.rt1098Status = window.rt1098Status; // already global from tab-1098.jsx
window.ratStatus = window.ratStatus;       // already global from tab-rat.jsx
