/* global React */
// Reports Layout B — sub-tabbed inside Reports (matches DAF 803 / Milestones subnav pattern).
// Default sub-tab = Overview: KPIs + top-3 preview from each report w/ "View all →" links.

const { useState: useStateB } = React;
const { AppShell: AppShellB, ReportsToolbar: ToolbarB, MiniBar: MiniBarB, Pill: PillB } = window.ReportsShell;
const DB = window.REPORTS_DATA;

const B_SUBNAV = [
  { key: 'overview', label: 'Overview' },
  { key: 'rollup',   label: 'Unit Roll-up' },
  { key: 'overdue',  label: 'Overdue / Due Soon' },
  { key: '1098',     label: '1098 & RAT' },
  { key: 'formal',   label: 'Formal Training' },
  { key: '797',      label: '797 Activity' },
  { key: 'quals',    label: 'Quals & SEI' },
  { key: 'print',    label: 'Member Print' },
];

function CardB({ title, sub, action, children, flush }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-head">
        <div>
          <div className="title" style={{ fontWeight: 600 }}>{title}</div>
          {sub && <div className="sub">{sub}</div>}
        </div>
        {action}
      </div>
      <div className={'card-body' + (flush ? ' flush' : '')}>{children}</div>
    </div>
  );
}

function KpiRowB() {
  const k = DB.KPIS;
  return (
    <div className="metric-grid metric-grid-5">
      <div className="metric"><div className="lbl">Members</div><div className="val">{k.totalMembers}</div></div>
      <div className="metric"><div className="lbl">Required Tasks</div><div className="val">{k.totalReq}</div></div>
      <div className="metric ok"><div className="lbl">Complete</div><div className="val">{k.totalComp}</div></div>
      <div className="metric warn"><div className="lbl">Due Soon (30d)</div><div className="val">{k.totalDue}</div></div>
      <div className="metric bad"><div className="lbl">Overdue</div><div className="val">{k.totalOver}</div></div>
    </div>
  );
}

function OverviewPanel({ goto }) {
  const overdue = DB.FLAT_DUES.filter(d => d.severity === 'overdue');
  const due = DB.FLAT_DUES.filter(d => d.severity === 'due-soon');
  const topReadiness = [...DB.ROLLUP].sort((a, b) => b.jqsPct - a.jqsPct).slice(0, 3);
  const bottomReadiness = [...DB.ROLLUP].sort((a, b) => a.jqsPct - b.jqsPct).slice(0, 3);

  return (
    <>
      <KpiRowB />

      <div className="rpt-overview-grid">
        <CardB
          title="Attention Required"
          sub={`${overdue.length} overdue · ${due.length} due soon`}
          action={<button className="btn ghost" onClick={() => goto('overdue')}>View all →</button>}
          flush
        >
          <table className="tbl tbl-fit">
            <thead>
              <tr><th style={{width:90}}>Due</th><th style={{width:150}}>Member</th><th>Task</th><th style={{width:70}}>Status</th></tr>
            </thead>
            <tbody>
              {DB.FLAT_DUES.slice(0, 5).map((d, i) => {
                const cls = d.severity === 'overdue' ? 'row-overdue' : 'row-warn';
                return (
                  <tr key={i} className={cls}>
                    <td className="mono-cell">{d.due}</td>
                    <td><span className="rpt-name">{d.member}</span></td>
                    <td>{d.task}</td>
                    <td>{d.severity === 'overdue' ? <PillB tone="bad">Over</PillB> : <PillB tone="warn">Due</PillB>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardB>

        <CardB
          title="Lowest JQS Completion"
          sub="Members below 50%"
          action={<button className="btn ghost" onClick={() => goto('rollup')}>View all →</button>}
          flush
        >
          <table className="tbl tbl-fit">
            <thead><tr><th style={{width:170}}>Member</th><th style={{width:60}}>Skill</th><th>Completion</th></tr></thead>
            <tbody>
              {bottomReadiness.map(m => (
                <tr key={m.id}>
                  <td><span className="rpt-name">{m.name}</span></td>
                  <td className="mono-cell">{m.skill}</td>
                  <td><MiniBarB pct={m.jqsPct} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardB>

        <CardB
          title="1098 & RAT — Worst Compliance"
          sub="Items with the most overdue across unit"
          action={<button className="btn ghost" onClick={() => goto('1098')}>View all →</button>}
          flush
        >
          <table className="tbl tbl-fit">
            <thead><tr><th>Task</th><th style={{width:60}}>Over</th><th style={{width:120}}>Compliance</th></tr></thead>
            <tbody>
              {[...DB.REC_TASKS_1098, ...DB.REC_TASKS_RAT]
                .sort((a, b) => b.over - a.over).slice(0, 5).map(t => {
                  const pct = Math.round(t.comp / t.req * 100);
                  const tone = t.over > 0 ? 'bad' : t.due > 0 ? 'warn' : 'ok';
                  return (
                    <tr key={t.id}>
                      <td>{t.name}</td>
                      <td className="mono-cell">{t.over || '—'}</td>
                      <td><MiniBarB pct={pct} tone={tone} /></td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </CardB>

        <CardB
          title="DAF 797 — Recent Activity"
          sub="Latest sign-offs"
          action={<button className="btn ghost" onClick={() => goto('797')}>View all →</button>}
          flush
        >
          <table className="tbl tbl-fit">
            <thead><tr><th style={{width:90}}>Date</th><th style={{width:140}}>Member</th><th>Task</th></tr></thead>
            <tbody>
              {DB.RECENT_797.slice(0, 5).map((r, i) => (
                <tr key={i}>
                  <td className="mono-cell">{r.date}</td>
                  <td><span className="rpt-name">{r.member}</span></td>
                  <td>{r.task}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardB>
      </div>
    </>
  );
}

function RollupPanel() {
  return (
    <CardB flush title="Unit Readiness Roll-up" sub="One row per member · click to open record">
      <table className="tbl tbl-fit rpt-rollup">
        <thead>
          <tr>
            <th style={{width:170}}>Member</th>
            <th style={{width:60}}>Grade</th>
            <th style={{width:50}}>Skill</th>
            <th style={{width:95}}>Status</th>
            <th>JQS-CFETP</th>
            <th>Formal Tng</th>
            <th style={{width:70}}>1098/RAT</th>
            <th style={{width:90}}>Updated</th>
            <th style={{width:26}}></th>
          </tr>
        </thead>
        <tbody>
          {DB.ROLLUP.map(m => {
            const cls = m.overdueCount ? 'row-overdue' : m.dueSoonCount ? 'row-warn' : '';
            return (
              <tr key={m.id} className={cls + ' rpt-row-link'}>
                <td><span className="rpt-name">{m.name}</span></td>
                <td className="mono-cell">{m.grade}</td>
                <td className="mono-cell">{m.skill}</td>
                <td><span className="rpt-status">{m.status}</span></td>
                <td><MiniBarB pct={m.jqsPct} /></td>
                <td><MiniBarB pct={m.formalPct} /></td>
                <td>
                  {m.overdueCount > 0 && <PillB tone="bad">{m.overdueCount} over</PillB>}
                  {m.overdueCount === 0 && m.dueSoonCount > 0 && <PillB tone="warn">{m.dueSoonCount} due</PillB>}
                  {m.overdueCount === 0 && m.dueSoonCount === 0 && <PillB tone="ok">✓</PillB>}
                </td>
                <td className="mono-cell">{m.lastUpdate}</td>
                <td className="rpt-link-arrow">›</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </CardB>
  );
}

function OverduePanel() {
  return (
    <CardB flush title="Overdue & Due Soon"
      sub={`${DB.FLAT_DUES.filter(d=>d.severity==='overdue').length} overdue · ${DB.FLAT_DUES.filter(d=>d.severity==='due-soon').length} due within 30 days`}>
      <table className="tbl tbl-fit">
        <thead>
          <tr><th style={{width:90}}>Due</th><th style={{width:60}}>Δ days</th><th style={{width:160}}>Member</th><th>Task</th><th style={{width:90}}>Source</th><th style={{width:80}}>Status</th><th style={{width:26}}></th></tr>
        </thead>
        <tbody>
          {DB.FLAT_DUES.map((d, i) => {
            const cls = d.severity === 'overdue' ? 'row-overdue' : 'row-warn';
            const tabLabel = { rat:'RAT', daf1098:'DAF 1098', jqs:'JQS', milestones:'Milestones' }[d.tab] || d.tab;
            return (
              <tr key={i} className={cls + ' rpt-row-link'}>
                <td className="mono-cell">{d.due}</td>
                <td className="mono-cell">{d.days < 0 ? d.days : '+' + d.days}</td>
                <td><span className="rpt-name">{d.member}</span></td>
                <td>{d.task}</td>
                <td><span className="chip">{tabLabel}</span></td>
                <td>{d.severity === 'overdue' ? <PillB tone="bad">Overdue</PillB> : <PillB tone="warn">Due Soon</PillB>}</td>
                <td className="rpt-link-arrow">›</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </CardB>
  );
}

function CompliancePanel() {
  return (
    <>
      <CardB flush title="DAF Form 1098 Compliance" sub="Recurring training across unit">
        <ComplianceTableB rows={DB.REC_TASKS_1098} />
      </CardB>
      <CardB flush title="Ready Airman Training Compliance" sub="Annual / triennial requirements">
        <ComplianceTableB rows={DB.REC_TASKS_RAT} />
      </CardB>
    </>
  );
}

function ComplianceTableB({ rows }) {
  return (
    <table className="tbl tbl-fit">
      <thead>
        <tr>
          <th>Task</th>
          <th style={{width:70}}>Freq</th>
          <th style={{width:70}}>Required</th>
          <th style={{width:70}}>Complete</th>
          <th style={{width:70}}>Due Soon</th>
          <th style={{width:70}}>Overdue</th>
          <th style={{width:140}}>Compliance</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(t => {
          const pct = Math.round(t.comp / t.req * 100);
          const tone = t.over > 0 ? 'bad' : t.due > 0 ? 'warn' : 'ok';
          return (
            <tr key={t.id}>
              <td>{t.name}</td>
              <td className="mono-cell">{t.freq}</td>
              <td className="mono-cell">{t.req}</td>
              <td className="mono-cell">{t.comp}</td>
              <td className="mono-cell">{t.due || '—'}</td>
              <td className="mono-cell">{t.over || '—'}</td>
              <td><MiniBarB pct={pct} tone={tone} /></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function FormalPanel() {
  return (
    <CardB flush title="Formal Training Status" sub="HAF / Initial / Continuation">
      <table className="tbl tbl-fit">
        <thead>
          <tr>
            <th style={{width:170}}>Member</th>
            <th>HAF Required</th>
            <th>Initial Quals</th>
            <th>Continuation</th>
            <th style={{width:130}}>Overall</th>
          </tr>
        </thead>
        <tbody>
          {DB.ROLLUP.map(m => (
            <tr key={m.id} className="rpt-row-link">
              <td><span className="rpt-name">{m.name}</span></td>
              <td className="mono-cell">{m.formal.haf}/{m.formal.totalHaf}</td>
              <td className="mono-cell">{m.formal.initial}/{m.formal.totalInit}</td>
              <td className="mono-cell">{m.formal.cont}/{m.formal.totalCont || '—'}</td>
              <td><MiniBarB pct={m.formalPct} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </CardB>
  );
}

function Activity797Panel() {
  return (
    <CardB flush title="DAF Form 797 — Recent Task Log Activity" sub="Cross-unit sign-offs, latest first">
      <table className="tbl tbl-fit">
        <thead>
          <tr>
            <th style={{width:90}}>Date</th>
            <th style={{width:160}}>Member</th>
            <th>Task</th>
            <th style={{width:160}}>Trainer</th>
            <th style={{width:90}}>Action</th>
          </tr>
        </thead>
        <tbody>
          {DB.RECENT_797.map((r, i) => (
            <tr key={i} className="rpt-row-link">
              <td className="mono-cell">{r.date}</td>
              <td><span className="rpt-name">{r.member}</span></td>
              <td>{r.task}</td>
              <td>{r.trainer}</td>
              <td><span className="chip">{r.type}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </CardB>
  );
}

function QualPanel() {
  return (
    <CardB flush title="Qualifications & SEI Matrix" sub="● awarded · ○ not yet">
      <table className="tbl tbl-fit rpt-matrix">
        <thead>
          <tr>
            <th style={{width:170}}>Member</th>
            {DB.QUAL_COLS.map(c => <th key={c.key} style={{width:80}}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {DB.ROLLUP.map(m => (
            <tr key={m.id} className="rpt-row-link">
              <td><span className="rpt-name">{m.name}</span></td>
              {DB.QUAL_COLS.map(c => {
                const v = DB.qualValue(m, c.key);
                return <td key={c.key} className="rpt-matrix-cell">
                  {v ? <span className="rpt-tick">●</span> : <span className="rpt-tick rpt-tick-empty">○</span>}
                </td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </CardB>
  );
}

function MemberPrintPanel() {
  const m = DB.ROLLUP[1]; // BRENNAN
  return (
    <CardB title="Export-Ready Member Summary" sub="Single-page printable record snapshot"
      action={
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <select className="rpt-select" defaultValue={m.name}>
            {DB.ROLLUP.map(r => <option key={r.id}>{r.name}</option>)}
          </select>
          <button className="btn primary">⎙ Print</button>
        </div>
      }
    >
      <div className="rpt-print">
        <div className="rpt-print-head">
          <div>
            <div className="rpt-print-name">{m.name}</div>
            <div className="rpt-print-meta">{m.grade} · 1C7{m.skill}1 · {m.status} · Generated 18 May 2026</div>
          </div>
          <div className="rpt-print-seal">AMTR</div>
        </div>
        <div className="rpt-print-grid">
          <div className="rpt-print-box">
            <div className="rpt-print-box-lbl">JQS-CFETP</div>
            <div className="rpt-print-box-val">{m.jqsDone} / {m.jqsReq}</div>
            <MiniBarB pct={m.jqsPct} />
          </div>
          <div className="rpt-print-box">
            <div className="rpt-print-box-lbl">Formal Training</div>
            <div className="rpt-print-box-val">{m.formalDone} / {m.formalTotal}</div>
            <MiniBarB pct={m.formalPct} />
          </div>
          <div className="rpt-print-box">
            <div className="rpt-print-box-lbl">Recurring (1098 + RAT)</div>
            <div className="rpt-print-box-val">
              {m.overdueCount === 0 && m.dueSoonCount === 0 ? 'Current' : `${m.overdueCount} over · ${m.dueSoonCount} due`}
            </div>
            <div className="rpt-print-status-row">
              {m.overdueCount > 0 && <PillB tone="bad">{m.overdueCount} overdue</PillB>}
              {m.dueSoonCount > 0 && <PillB tone="warn">{m.dueSoonCount} due soon</PillB>}
              {m.overdueCount === 0 && m.dueSoonCount === 0 && <PillB tone="ok">All current</PillB>}
            </div>
          </div>
          <div className="rpt-print-box">
            <div className="rpt-print-box-lbl">Qualifications</div>
            <div className="rpt-print-tags">
              {m.qtp.map(q => <span key={q} className="chip">{q}</span>)}
              {m.sei.map(s => <span key={s} className="chip">SEI {s}</span>)}
              {!m.qtp.length && !m.sei.length && <span className="rpt-muted">None awarded</span>}
            </div>
          </div>
        </div>

        <div className="rpt-print-section">
          <div className="rpt-print-section-title">Outstanding Items</div>
          {[...m.over.map(o=>({...o,sev:'overdue'})), ...m.dueSoon.map(o=>({...o,sev:'due'}))].length === 0
            ? <div className="rpt-muted">None — member is current.</div>
            : (
              <table className="tbl tbl-fit">
                <thead><tr><th style={{width:100}}>Due</th><th>Task</th><th style={{width:90}}>Source</th><th style={{width:90}}>Status</th></tr></thead>
                <tbody>
                  {[...m.over.map(o=>({...o,sev:'overdue'})), ...m.dueSoon.map(o=>({...o,sev:'due'}))].map((o, i) => (
                    <tr key={i} className={o.sev === 'overdue' ? 'row-overdue' : 'row-warn'}>
                      <td className="mono-cell">{o.due}</td>
                      <td>{o.task}</td>
                      <td><span className="chip">{({rat:'RAT',daf1098:'DAF 1098',jqs:'JQS',milestones:'Milestones'})[o.tab]||o.tab}</span></td>
                      <td>{o.sev === 'overdue' ? <PillB tone="bad">Overdue</PillB> : <PillB tone="warn">Due Soon</PillB>}</td>
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
    </CardB>
  );
}

function ReportsLayoutB() {
  const [range, setRange] = useStateB('30d');
  const [sub, setSub] = useStateB('overview');

  return (
    <AppShellB
      headTitle="Reports"
      headSub="Unit-wide roll-up · 1C7X1 · NAMT view · As of 18 May 2026"
    >
      <ToolbarB range={range} setRange={setRange} />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="subnav">
          {B_SUBNAV.map(t => (
            <button key={t.key} className={sub === t.key ? 'active' : ''} onClick={() => setSub(t.key)}>{t.label}</button>
          ))}
        </div>
      </div>

      {sub === 'overview' && <OverviewPanel goto={setSub} />}
      {sub === 'rollup'   && <RollupPanel />}
      {sub === 'overdue'  && <OverduePanel />}
      {sub === '1098'     && <CompliancePanel />}
      {sub === 'formal'   && <FormalPanel />}
      {sub === '797'      && <Activity797Panel />}
      {sub === 'quals'    && <QualPanel />}
      {sub === 'print'    && <MemberPrintPanel />}
    </AppShellB>
  );
}

window.ReportsLayoutB = ReportsLayoutB;
