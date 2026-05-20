/* global React */
// Shared app shell — topbar + sidebar — matches the live AMTR app.
// Reports tab is the active nav item; role is fixed to NAMT.

const { useState } = React;

const NAV = [
  { label: 'Member', items: [{ key: 'cover', label: 'Cover' }] },
  { label: 'Qualifications', items: [
    { key: 'qualifications', label: 'Qualifications' },
    { key: 'formal',         label: 'Formal Training' },
    { key: 'jqs',            label: 'JQS-CFETP' },
  ]},
  { label: 'Training Records', items: [
    { key: 'daf623a', label: 'DAF Form 623A' },
    { key: 'daf797',  label: 'DAF Form 797' },
    { key: 'daf803',  label: 'DAF Form 803' },
  ]},
  { label: 'Training Plan', items: [
    { key: 'milestones', label: 'QTP / PCG Milestones' },
  ]},
  { label: 'Recurring Training', items: [
    { key: 'daf1098', label: 'DAF Form 1098' },
    { key: 'rat',     label: 'Ready Airman Training' },
  ]},
  { label: 'Reports', items: [
    { key: 'reports', label: 'Reports', tag: 'NAMT' },
  ]},
  { label: 'Reference', items: [
    { key: 'profkey', label: 'Proficiency Code Key' },
    { key: 'tsc',     label: 'Training Status Codes' },
  ]},
  { label: 'Supporting', items: [{ key: 'files', label: 'Files' }] },
];

function AppShell({ children, headTitle, headSub, headAction }) {
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="seal" aria-hidden="true">AM</div>
          <div className="title-block">
            <div className="title">Airfield Management Training Record</div>
          </div>
        </div>

        <div className="spacer"></div>

        <div className="control">
          <span className="label">Record</span>
          <select defaultValue="unit">
            <option value="unit">— Unit view —</option>
            <option>AGUILAR, M.</option>
            <option>BRENNAN, T.</option>
          </select>
          <button className="icon-btn" title="Add new record">+</button>
          <button className="icon-btn" title="Delete current record">−</button>
        </div>

        <div className="role-toggle">
          <button>Trainee</button>
          <button>Trainer</button>
          <button>Certifier</button>
          <button className="active">NAMT</button>
          <button>AFM</button>
        </div>

        <button className="icon-btn" title="Export all records as JSON">↓ Export</button>
        <button className="icon-btn" title="Import records from JSON">↑ Import</button>
      </header>

      <div className="body-shell">
        <aside className="sidebar">
          {NAV.map(group => (
            <div className="nav-group" key={group.label}>
              {group.items.map(it => (
                <button
                  key={it.key}
                  className={'nav-item ' + (it.key === 'reports' ? 'active' : '')}
                >
                  <span>{it.label}</span>
                  {it.tag && <span className="nav-tag">{it.tag}</span>}
                </button>
              ))}
            </div>
          ))}
        </aside>

        <main className="main">
          <div className="mode-banner namt-banner">
            <span className="dot"></span>
            <span><strong>NAMT view.</strong> Unit-wide read-only roll-ups. Click any row to jump to that member's record.</span>
          </div>
          {(headTitle || headAction) && (
            <div className="page-head">
              <div>
                <h1 className="page-title">{headTitle}</h1>
                {headSub && <div className="page-sub">{headSub}</div>}
              </div>
              {headAction}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

// Date range filter chip group + print button — used by both layouts
function ReportsToolbar({ range, setRange }) {
  const opts = ['30d', '60d', '90d', 'YTD', 'All'];
  return (
    <div className="rpt-toolbar">
      <div className="rpt-filter-group">
        <span className="rpt-filter-label">Trained within</span>
        <div className="rpt-chip-group">
          {opts.map(o => (
            <button
              key={o}
              className={'rpt-chip ' + (range === o ? 'active' : '')}
              onClick={() => setRange(o)}
            >{o}</button>
          ))}
        </div>
      </div>
      <div className="rpt-toolbar-right">
        <button className="btn">⎙ Print to PDF</button>
        <button className="btn">↓ Export CSV</button>
      </div>
    </div>
  );
}

// Small inline progress bar (used in roll-up rows)
function MiniBar({ pct, tone }) {
  const t = tone || (pct >= 90 ? 'ok' : pct >= 60 ? 'warn' : 'bad');
  return (
    <div className="mini-bar">
      <div className={'mini-bar-fill tone-' + t} style={{ width: pct + '%' }}></div>
      <span className="mini-bar-pct">{pct}%</span>
    </div>
  );
}

// Status pill
function Pill({ tone, children }) {
  return <span className={'rpt-pill tone-' + tone}>{children}</span>;
}

window.ReportsShell = { AppShell, ReportsToolbar, MiniBar, Pill };
