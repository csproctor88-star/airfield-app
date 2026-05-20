/* global React, ReactDOM */
// Top-level app: state, member switcher, role toggle, sidebar, tab routing,
// export/import JSON, localStorage persistence.

const { useState, useEffect, useMemo, useRef } = React;

const NAV = [
  {
    label: "Member",
    items: [
      { key: "cover",        label: "Cover" },
    ],
  },
  {
    label: "Qualifications",
    items: [
      { key: "qualifications", label: "Qualifications" },
      { key: "formal",         label: "Formal Training" },
      { key: "jqs",            label: "JQS-CFETP" },
    ],
  },
  {
    label: "Training Records",
    items: [
      { key: "daf623a",  label: "DAF Form 623A" },
      { key: "daf797",   label: "DAF Form 797" },
      { key: "daf803",   label: "DAF Form 803" },
    ],
  },
  {
    label: "Training Plan",
    items: [
      { key: "milestones", label: "QTP / PCG Milestones" },
    ],
  },
  {
    label: "Recurring Training",
    items: [
      { key: "daf1098",  label: "DAF Form 1098" },
      { key: "rat",      label: "Ready Airman Training" },
    ],
  },
  {
    label: "Supporting",
    items: [
      { key: "files",    label: "Files" },
    ],
  },
];

// Top-level views (above the per-record sidebar).
//   landing       – portal page with tiles for each section
//   record        – the original member record (sidebar + tab routing)
//   reports       – unit-wide reports (NAMT/AFM gated)
//   notifications – placeholder for now

function App() {
  const [state, setState] = useState(() => window.AMTR_Store.initialState());
  const [tab, setTab] = useState("cover");
  const [view, setView] = useState(() => {
    try { return localStorage.getItem("amtr_view") || "landing"; } catch (_) { return "landing"; }
  });
  const [refSub, setRefSub] = useState(() => {
    try { return localStorage.getItem("amtr_refsub") || "tsc"; } catch (_) { return "tsc"; }
  });
  const fileInputRef = useRef(null);
  const excelInputRef = useRef(null);

  // persist on every change
  useEffect(() => {
    window.AMTR_Store.saveState(state);
  }, [state]);
  useEffect(() => {
    try { localStorage.setItem("amtr_view", view); } catch (_) {}
  }, [view]);
  useEffect(() => {
    try { localStorage.setItem("amtr_refsub", refSub); } catch (_) {}
  }, [refSub]);

  const activeMember = state.members.find(m => m.id === state.activeMemberId) || state.members[0];
  const role = state.role;

  // RAT does not apply to Civilians, Contractors, or Separated members.
  const RAT_EXEMPT = ["Civilian", "Contractor", "Separated"];
  const ratExempt = RAT_EXEMPT.includes(activeMember?.cover?.status);

  // If the user is currently on a tab that disappears for this member, fall back to Cover.
  useEffect(() => {
    if (ratExempt && tab === "rat") setTab("cover");
  }, [ratExempt, tab]);

  // ----- member CRUD -----
  const setRole = (r) => setState(s => ({ ...s, role: r }));
  const setActiveMember = (id) => setState(s => ({ ...s, activeMemberId: id }));
  const goToMember = (id, nextTab) => {
    setState(s => ({ ...s, activeMemberId: id }));
    if (nextTab) setTab(nextTab);
    setView("record");
  };
  const updateActiveMember = (etr) => setState(s => ({
    ...s,
    members: s.members.map(m => m.id === etr.id ? etr : m),
  }));
  const addMember = () => {
    const name = prompt("New member full name (Last, First M.):", "");
    if (!name) return;
    const m = window.AMTR_Store.emptyMember(name);
    setState(s => ({ ...s, members: [...s.members, m], activeMemberId: m.id }));
  };
  const deleteCurrentMember = () => {
    if (state.members.length <= 1) {
      alert("At least one member must exist.");
      return;
    }
    if (!confirm(`Delete ${activeMember.cover.fullName || "this record"}? This cannot be undone.`)) return;
    setState(s => {
      const remaining = s.members.filter(m => m.id !== s.activeMemberId);
      return { ...s, members: remaining, activeMemberId: remaining[0].id };
    });
  };

  // ----- export / import -----
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0,10);
    a.href = url;
    a.download = `amtr-export-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const importExcel = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    if (typeof window.XLSX === "undefined" || !window.AMTRExcelImport) {
      alert("Excel importer is still loading. Try again in a moment.");
      return;
    }
    try {
      const result = await window.AMTRExcelImport.importExcel(files, state);
      setState(s => ({
        ...s,
        members: [...s.members, result.member],
        activeMemberId: result.member.id,
        formalCatalog: result.formalCatalogPatch,
        rt1098: result.rt1098Patch,
      }));
      setTab("cover");
      const s = result.stats;
      alert([
        "Imported new record: " + (result.member.cover.fullName || "(unnamed)"),
        "",
        "Cover fields:        " + [result.member.cover.fullName, result.member.cover.grade, result.member.cover.dafsc, result.member.cover.tsc].filter(Boolean).length + " / 4",
        "QTPs / PCGs set:     " + s.qtpsSet,
        "Yes-No quals set:    " + s.ynSet,
        "JQS items:           " + s.jqsItems,
        "Formal \u2014 matched:    " + s.formalLinked + "  (" + s.formalAdded + " new courses added)",
        "623A entries:        " + s.daf623a,
        "797 entries:         " + s.daf797,
        "1098 \u2014 matched:      " + s.daf1098Linked + "  (" + s.daf1098Added + " new tasks added)",
      ].join("\n"));
    } catch (err) {
      console.error("Excel import failed", err);
      alert("Excel import failed: " + (err && err.message ? err.message : String(err)));
    }
  };

  const importJson = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const parsed = JSON.parse(r.result);
        if (!parsed.members || !Array.isArray(parsed.members)) throw new Error("Invalid file");
        if (!confirm(`Import will REPLACE current data (${state.members.length} member(s)) with ${parsed.members.length} member(s). Continue?`)) return;
        setState(parsed);
      } catch (err) {
        alert("Import failed: " + err.message);
      }
    };
    r.readAsText(f);
    e.target.value = "";
  };

  // ----- render tab content -----
  const renderTab = () => {
    const common = { etr: activeMember, update: updateActiveMember, role };
    const jqsCatalog = state.jqsCatalog || (window.__JQS_CATALOG ? window.__JQS_CATALOG.catalog : []);
    const jqsCatalogMeta = state.jqsCatalogMeta || (window.__JQS_CATALOG ? window.__JQS_CATALOG.meta : {});
    const setJqsCatalog = (next) => setState(s => ({ ...s, jqsCatalog: next }));
    const rt1098 = state.rt1098 || window.AMTR_Store.emptyRt1098();
    const setRt1098 = (next) => setState(s => ({ ...s, rt1098: typeof next === "function" ? next(s.rt1098) : next }));
    const formalCatalog = state.formalCatalog || window.AMTR_Store.defaultFormalCatalog();
    const setFormalCatalog = (next) => setState(s => ({ ...s, formalCatalog: typeof next === "function" ? next(s.formalCatalog) : next }));
    switch (tab) {
      case "cover":         return <TabCover {...common} />;
      case "qualifications":return <TabQualifications {...common} />;
      case "formal":        return <TabFormalTraining {...common} formalCatalog={formalCatalog} setFormalCatalog={setFormalCatalog} />;;
      case "daf623a":       return <Tab623A {...common} />;
      case "daf797":        return <Tab797 {...common} />;
      case "daf803":        return <Tab803 {...common} />;
      case "milestones":    return <TabMilestones {...common} />;
      case "daf1098":       return <Tab1098 {...common} rt1098={rt1098} setRt1098={setRt1098} />;
      case "jqs":           return <TabJqs {...common} catalog={jqsCatalog} catalogMeta={jqsCatalogMeta} setCatalog={setJqsCatalog} />;
      case "profkey":       return <TabProficiencyKey />;
      case "tsc":           return <TabTrainingStatusCodes />;
      case "files":         return <TabFiles {...common} />;
      case "rat":           return <TabRAT {...common} />;
      default: return <div>Unknown tab</div>;
    }
  };

  // ===== TOP-LEVEL RENDER =====
  // Header always shows the program brand. Per-section controls swap in/out below it.
  const sectionLabel =
    view === "landing"       ? "Home"
    : view === "record"      ? `Training Record · ${activeMember?.cover?.fullName || "(unnamed)"}`
    : view === "reports"     ? "Reports"
    : view === "notifications" ? "Notifications"
    : view === "references"  ? "Training References"
    : "";

  return (
    <div className="app">
      {/* TOP BAR */}
      <header className="topbar">
        <div className="brand">
          <div className="seal" aria-hidden="true">AM</div>
          <div className="title-block">
            <div className="title">Airfield Management Training Program</div>
            <div className="subtitle">{sectionLabel}</div>
          </div>
        </div>

        {view !== "landing" && (
          <button className="icon-btn" onClick={() => setView("landing")} title="Back to program home" style={{marginLeft: 8}}>
            ← Home
          </button>
        )}

        <div className="spacer"></div>

        {view === "record" && (
          <div className="control">
            <span className="label">Record</span>
            <select value={state.activeMemberId} onChange={(e)=>setActiveMember(e.target.value)}>
              {state.members.map(m => (
                <option key={m.id} value={m.id}>{m.cover.fullName || "(unnamed)"}</option>
              ))}
            </select>
            <button className="icon-btn" onClick={addMember} title="Add new record">+</button>
            <button className="icon-btn" onClick={deleteCurrentMember} title="Delete current record">−</button>
          </div>
        )}

        <div className="role-toggle">
          <button className={role==="trainee"?"active":""} onClick={()=>setRole("trainee")}>Trainee</button>
          <button className={role==="trainer"?"active":""} onClick={()=>setRole("trainer")}>Trainer</button>
          <button className={role==="certifier"?"active":""} onClick={()=>setRole("certifier")}>Certifier</button>
          <button className={role==="namt"?"active":""} onClick={()=>setRole("namt")}>NAMT</button>
          <button className={role==="afm"?"active":""} onClick={()=>setRole("afm")}>AFM</button>
        </div>

        {view === "landing" && (
          <>
            <button className="icon-btn" onClick={()=>excelInputRef.current?.click()} title="Upload Excel training record (creates a new member)">↑ Upload Excel</button>
            <input ref={excelInputRef} type="file" multiple accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style={{display:"none"}} onChange={importExcel} />
            <button className="icon-btn" onClick={exportJson} title="Export all records as JSON">↓ Export</button>
            <button className="icon-btn" onClick={()=>fileInputRef.current?.click()} title="Import records from JSON">↑ Import</button>
            <input ref={fileInputRef} type="file" accept="application/json" style={{display:"none"}} onChange={importJson} />
          </>
        )}
      </header>

      {view === "landing" && (
        <LandingPage onGo={setView} memberCount={state.members.length} role={role} />
      )}

      {view === "reports" && (
        <main className="main" style={{paddingTop: 28}}>
          <ModeBanner role={role} />
          <TabReports state={state} role={role} goToMember={goToMember} />
        </main>
      )}

      {view === "notifications" && (
        <main className="main" style={{paddingTop: 28}}>
          <NotificationsPlaceholder />
        </main>
      )}

      {view === "references" && (
        <main className="main" style={{paddingTop: 28}}>
          <ReferencesPage sub={refSub} setSub={setRefSub} />
        </main>
      )}

      {view === "record" && (
        <div className="body-shell">
          {/* SIDEBAR */}
          <aside className="sidebar">
            {NAV.filter(g => !g.namtOnly || role === "namt" || role === "afm").map(group => {
              const items = group.items.filter(it => !(it.key === "rat" && ratExempt));
              if (!items.length) return null;
              return (
                <div className="nav-group" key={group.label}>
                  {items.map(it => (
                    <button
                      key={it.key}
                      className={"nav-item " + (tab === it.key ? "active" : "")}
                      onClick={() => setTab(it.key)}
                    >
                      {it.label}
                    </button>
                  ))}
                </div>
              );
            })}
          </aside>

          {/* MAIN */}
          <main className="main">
            <ModeBanner role={role} />
            {renderTab()}
          </main>
        </div>
      )}
    </div>
  );
}

function LandingPage({ onGo, memberCount, role }) {
  const isNamtOrAfm = role === "namt" || role === "afm";
  const tiles = [
    {
      key: "record",
      label: "Training Record",
      sub: "Open, edit, and import individual airman training records.",
      stat: `${memberCount} member${memberCount === 1 ? "" : "s"}`,
    },
    {
      key: "notifications",
      label: "Notifications",
      sub: "Upcoming due-soon and overdue tasks across the unit.",
      stat: "Coming soon",
      muted: true,
    },
    {
      key: "references",
      label: "Training References",
      sub: "Training Status Codes, Proficiency Code Key, and other shared reference material.",
      stat: "Reference",
    },
    isNamtOrAfm && {
      key: "reports",
      label: "Reports",
      sub: "Unit-wide roll-up across every airman's training record.",
      stat: "NAMT · AFM view",
    },
  ].filter(Boolean);
  return (
    <main className="main landing">
      <div className="landing-hero">
        <h1 className="landing-title">Airfield Management Training Program</h1>
        <p className="landing-sub">Select a section to continue.</p>
      </div>
      <div className="landing-grid">
        {tiles.map(t => (
          <button
            key={t.key}
            type="button"
            className={"landing-tile" + (t.muted ? " muted" : "")}
            onClick={() => onGo(t.key)}
          >
            <div className="landing-tile-label">{t.label}</div>
            <div className="landing-tile-sub">{t.sub}</div>
            <div className="landing-tile-foot">
              <span className="landing-tile-arrow">→</span>
            </div>
          </button>
        ))}
      </div>
    </main>
  );
}

function NotificationsPlaceholder() {
  return (
    <div>
      <PageHead crumb="Notifications" title="Notifications" formId="" />
      <Card title="Coming soon" sub="Unit-wide alerts for upcoming and overdue training">
        <div style={{padding:"40px 16px", textAlign:"center", color:"var(--muted)"}}>
          This area will list due-soon and overdue tasks across the unit so NAMT/AFM
          can act on them at a glance. Configuration coming in a later update.
        </div>
      </Card>
    </div>
  );
}

const REFERENCES_SUBNAV = [
  { key: "tsc",     label: "Training Status Codes" },
  { key: "profkey", label: "Proficiency Code Key" },
  // future additions go here — e.g. { key: "calendar", label: "Training Program Calendar" }
];

function ReferencesPage({ sub, setSub }) {
  return (
    <div>
      <PageHead crumb="Training References" title="Training References" formId="SHARED REFERENCE LIBRARY" />
      <Card flush>
        <div className="subnav">
          {REFERENCES_SUBNAV.map(t => (
            <button key={t.key} className={sub === t.key ? "active" : ""} onClick={() => setSub(t.key)}>{t.label}</button>
          ))}
        </div>
      </Card>
      <div style={{marginTop: 14}}>
        {sub === "tsc"     && <TabTrainingStatusCodes />}
        {sub === "profkey" && <TabProficiencyKey />}
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("app"));
root.render(<App />);
