/* global React */
// Reports Layout A — single scrolling page, KPI strip + stacked report cards.

const { useState: useStateA } = React;
const { AppShell: AppShellA, ReportsToolbar: ToolbarA, MiniBar: MiniBarA, Pill: PillA } = window.ReportsShell;
const D = window.REPORTS_DATA;

function KpiRow() {
  const k = D.KPIS;
  return (
    <div className="metric-grid metric-grid-5">
      <div className="metric">
        <div className="lbl">Members</div>
        <div className="val">{k.totalMembers}</div>
      </div>
      <div className="metric">
        <div className="lbl">Required Tasks</div>
        <div className="val">{k.totalReq}</div>
      </div>
      <div className="metric ok">
        <div className="lbl">Complete</div>
        <div className="val">{k.totalComp}</div>
      </div>
      <div className="metric warn">
        <div className="lbl">Due Soon (30d)</div>
        <div className="val">{k.totalDue}</div>
      </div>
      <div className="metric bad">
        <div className="lbl">Overdue</div>
        <div className="val">{k.totalOver}</div>
      </div>
    </div>
  );
}

function CardA({ title, sub, action, children, flush }) {
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

function RollupTable() {
  return (
    <table className="tbl tbl-fit rpt-rollup">
      <thead>
        <tr>
          <th style={{ width: 170 }}>Member</th>
          <th style={{ width: 60 }}>Grade</th>
          <th style={{ width: 50 }}>Skill</th>
          <th style={{ width: 95 }}>Status</th>
          <th>JQS-CFETP</th>
          <th>Formal Tng</th>
          <th style={{ width: 70 }}>1098/RAT</th>
          <th style={{ width: 90 }}>Updated</th>
          <th style={{ width: 26 }}></th>
        </tr>
      </thead>
      <tbody>
        {D.ROLLUP.map(m => {
          const cls = m.overdueCount ? 'row-overdue' : m.dueSoonCount ? 'row-warn' : '';
          return (
            <tr key={m.id} className={cls + ' rpt-row-link'}>
              <td><span className="rpt-name">{m.name}</span></td>
              <td className="mono-cell">{m.grade}</td>
              <td className="mono-cell">{m.skill}</td>
              <td><span className="rpt-status">{m.status}</span></td>
              <td><MiniBarA pct={m.jqsPct} /></td>
              <td><MiniBarA pct={m.formalPct} /></td>
              <td>
                {m.overdueCount > 0 && <PillA tone="bad">{m.overdueCount} over</PillA>}
                {m.overdueCount === 0 && m.dueSoonCount > 0 && <PillA tone="warn">{m.dueSoonCount} due</PillA>}
                {m.overdueCount === 0 && m.dueSoonCount === 0 && <PillA tone="ok">✓</PillA>}
              </td>
              <td className="mono-cell">{m.lastUpdate}</td>
              <td className="rpt-link-arrow">›</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function OverdueList() {
  return (
    <table className="tbl tbl-fit">
      <thead>
        <tr>
          <th style={{ width: 90 }}>Due</th>
          <th style={{ width: 60 }}>Δ days</th>
          <th style={{ width: 160 }}>Member</th>
          <th>Task</th>
          <th style={{ width: 90 }}>Source</th>
          <th style={{ width: 80 }}>Status</th>
          <th style={{ width: 26 }}></th>
        </tr>
      </thead>
      <tbody>
        {D.FLAT_DUES.map((d, i) => {
          const cls = d.severity === 'overdue' ? 'row-overdue' : 'row-warn';
          const tabLabel = { rat: 'RAT', daf1098: 'DAF 1098', jqs: 'JQS', milestones: 'Milestones' }[d.tab] || d.tab;
          return (
            <tr key={i} className={cls + ' rpt-row-link'}>
              <td className="mono-cell">{d.due}</td>
              <td className="mono-cell">{d.days < 0 ? d.days : '+' + d.days}</td>
              <td><span className="rpt-name">{d.member}</span></td>
              <td>{d.task}</td>
              <td><span className="chip">{tabLabel}</span></td>
              <td>{d.severity === 'overdue' ? <PillA tone="bad">Overdue</PillA> : <PillA tone="warn">Due Soon</PillA>}</td>
              <td className="rpt-link-arrow">›</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ComplianceTable({ rows, label }) {
  return (
    <table className="tbl tbl-fit">
      <thead>
        <tr>
          <th>Task</th>
          <th style={{ width: 70 }}>Freq</th>
          <th style={{ width: 70 }}>Required</th>
          <th style={{ width: 70 }}>Complete</th>
          <th style={{ width: 70 }}>Due Soon</th>
          <th style={{ width: 70 }}>Overdue</th>
          <th style={{ width: 140 }}>Compliance</th>
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
              <td><MiniBarA pct={pct} tone={tone} /></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function FormalTrainingTable() {
  return (
    <table className="tbl tbl-fit">
      <thead>
        <tr>
          <th style={{ width: 170 }}>Member</th>
          <th>HAF Required</th>
          <th>Initial Quals</th>
          <th>Continuation</th>
          <th style={{ width: 130 }}>Overall</th>
        </tr>
      </thead>
      <tbody>
        {D.ROLLUP.map(m => (
          <tr key={m.id} className="rpt-row-link">
            <td><span className="rpt-name">{m.name}</span></td>
            <td className="mono-cell">{m.formal.haf}/{m.formal.totalHaf}</td>
            <td className="mono-cell">{m.formal.initial}/{m.formal.totalInit}</td>
            <td className="mono-cell">{m.formal.cont}/{m.formal.totalCont || '—'}</td>
            <td><MiniBarA pct={m.formalPct} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function QualMatrix() {
  return (
    <table className="tbl tbl-fit rpt-matrix">
      <thead>
        <tr>
          <th style={{ width: 170 }}>Member</th>
          {D.QUAL_COLS.map(c => <th key={c.key} style={{ width: 80 }}>{c.label}</th>)}
        </tr>
      </thead>
      <tbody>
        {D.ROLLUP.map(m => (
          <tr key={m.id} className="rpt-row-link">
            <td><span className="rpt-name">{m.name}</span></td>
            {D.QUAL_COLS.map(c => {
              const v = D.qualValue(m, c.key);
              return <td key={c.key} className="rpt-matrix-cell">
                {v ? <span className="rpt-tick">●</span> : <span className="rpt-tick rpt-tick-empty">○</span>}
              </td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Recent797() {
  return (
    <table className="tbl tbl-fit">
      <thead>
        <tr>
          <th style={{ width: 90 }}>Date</th>
          <th style={{ width: 160 }}>Member</th>
          <th>Task</th>
          <th style={{ width: 160 }}>Trainer</th>
          <th style={{ width: 90 }}>Action</th>
        </tr>
      </thead>
      <tbody>
        {D.RECENT_797.map((r, i) => (
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
  );
}

function ReportsLayoutA() {
  const [range, setRange] = useStateA('30d');
  return (
    <AppShellA
      headTitle="Reports"
      headSub="Unit-wide roll-up · 1C7X1 · NAMT view · As of 18 May 2026"
    >
      <ToolbarA range={range} setRange={setRange} />
      <KpiRow />

      <CardA flush title="Unit Readiness Roll-up" sub="One row per member — click to open record">
        <RollupTable />
      </CardA>

      <CardA flush
        title="Overdue & Due Soon"
        sub={`${D.FLAT_DUES.filter(d=>d.severity==='overdue').length} overdue · ${D.FLAT_DUES.filter(d=>d.severity==='due-soon').length} due within 30 days`}
      >
        <OverdueList />
      </CardA>

      <CardA flush title="DAF Form 1098 Compliance" sub="Recurring training across unit">
        <ComplianceTable rows={D.REC_TASKS_1098} label="1098" />
      </CardA>

      <CardA flush title="Ready Airman Training (RAT) Compliance" sub="Annual / triennial requirements">
        <ComplianceTable rows={D.REC_TASKS_RAT} label="RAT" />
      </CardA>

      <CardA flush title="Formal Training Status" sub="HAF / Initial / Continuation">
        <FormalTrainingTable />
      </CardA>

      <CardA flush title="Qualifications & SEI Matrix" sub="● awarded · ○ not yet">
        <QualMatrix />
      </CardA>

      <CardA flush title="DAF Form 797 — Recent Activity" sub="Last 8 entries across unit">
        <Recent797 />
      </CardA>
    </AppShellA>
  );
}

window.ReportsLayoutA = ReportsLayoutA;
