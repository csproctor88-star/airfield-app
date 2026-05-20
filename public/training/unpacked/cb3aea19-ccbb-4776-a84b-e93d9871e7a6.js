/* global React */
// DAF Form 623A — daily training entries with NAMT + AFM dual sign-off

const { useState: useState623A, useRef: useRef623A, useEffect: useEffect623A } = React;

// Combobox: a single text input that doubles as a picker. Type to filter, click
// the chevron (or focus) to open the dropdown, click an option to fill the input.
// Picking the same value twice in a row still works (unlike <input list=>).
function EntryTypeCombo({ value, onChange, options, placeholder, disabled }) {
  const [open, setOpen] = useState623A(false);
  const [highlight, setHighlight] = useState623A(-1);
  const [rect, setRect] = useState623A(null);
  const wrapRef = useRef623A(null);
  const inputRef = useRef623A(null);
  const listRef = useRef623A(null);

  useEffect623A(() => {
    if (!open) return;
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target) && listRef.current && !listRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Track input's bounding rect so the fixed-positioned dropdown can escape
  // the .card's overflow:hidden clip context.
  useEffect623A(() => {
    if (!open) { setRect(null); return; }
    const refresh = () => {
      const r = inputRef.current && inputRef.current.getBoundingClientRect();
      if (r) setRect({ left: r.left, top: r.bottom + 2, width: r.width });
    };
    refresh();
    window.addEventListener("scroll", refresh, true);
    window.addEventListener("resize", refresh);
    return () => {
      window.removeEventListener("scroll", refresh, true);
      window.removeEventListener("resize", refresh);
    };
  }, [open]);

  const v = (value || "").toLowerCase().trim();
  const filtered = v ? options.filter(o => o.toLowerCase().includes(v)) : options;

  const select = (opt) => { onChange(opt); setOpen(false); setHighlight(-1); };
  const onKey = (e) => {
    if (e.key === "ArrowDown") { if (!open) setOpen(true); setHighlight(h => Math.min((h < 0 ? -1 : h) + 1, filtered.length - 1)); e.preventDefault(); return; }
    if (e.key === "ArrowUp")   { setHighlight(h => Math.max(h - 1, 0)); e.preventDefault(); return; }
    if (e.key === "Enter")     { if (open && highlight >= 0 && filtered[highlight]) { select(filtered[highlight]); e.preventDefault(); } return; }
    if (e.key === "Escape")    { setOpen(false); setHighlight(-1); return; }
  };

  return (
    <div ref={wrapRef} style={{position:"relative"}}>
      <input
        ref={inputRef}
        type="text"
        value={value || ""}
        onChange={(ev) => { onChange(ev.target.value); if (!open) setOpen(true); setHighlight(-1); }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={onKey}
        placeholder={placeholder}
        disabled={disabled}
        style={{width: "100%", paddingRight: 26}}
      />
      <span
        onMouseDown={(ev) => { ev.preventDefault(); if (!disabled) setOpen(o => !o); }}
        title={open ? "Close picker" : "Open preset list"}
        aria-hidden="true"
        style={{position:"absolute", right:6, top:"50%", transform:"translateY(-50%)", color:"var(--muted-2)", cursor: disabled ? "not-allowed" : "pointer", fontSize:11, userSelect:"none", padding: "2px 4px", lineHeight: 1}}
      >▾</span>
      {open && !disabled && rect && (
        <ul ref={listRef} role="listbox" style={{
          position:"fixed", top: rect.top, left: rect.left, width: rect.width,
          margin:0, padding:"4px 0",
          background:"#fff", border:"1px solid var(--line)",
          borderRadius:"var(--r-sm)", boxShadow:"var(--shadow-2)",
          zIndex: 9999, maxHeight: 240, overflowY: "auto", listStyle: "none",
        }}>
          {filtered.length === 0 && (
            <li style={{padding:"6px 10px", fontSize:12, color:"var(--muted)", fontStyle:"italic"}}>No matching presets — keep typing for a custom entry type.</li>
          )}
          {filtered.map((opt, i) => (
            <li key={opt}
              role="option"
              aria-selected={i === highlight}
              onMouseEnter={() => setHighlight(i)}
              onMouseLeave={() => setHighlight(-1)}
              onMouseDown={(ev) => { ev.preventDefault(); select(opt); }}
              style={{padding:"6px 10px", fontSize:13, cursor:"pointer", background: i === highlight ? "var(--stripe)" : "transparent"}}
            >{opt}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Tab623A({ etr, update, role }) {
  const ro = role === "trainee";
  const canReorder = role === "namt" || role === "afm";
  const entries = etr.daf623a || [];
  const [expanded, setExpanded] = useState623A({});
  const toggleExpanded = (id) => setExpanded(s => ({ ...s, [id]: !s[id] }));

  // Search + sort
  const [query, setQuery] = useState623A("");
  const [sortOrder, setSortOrder] = useState623A("desc"); // 'desc' = newest first; 'asc' = oldest first
  const isFiltered = query.trim() !== "";
  const matches = (e, q) => {
    const fields = [e.date, e.type, e.traineeComment, e.traineeInitials, e.trainerComment, e.trainerInitials, e.namtComment, e.namtInitials, e.afmComment, e.afmInitials];
    return fields.some(v => v && v.toString().toLowerCase().includes(q));
  };
  const visible = entries
    .map((e, origIdx) => ({ e, origIdx }))
    .filter(({ e }) => !isFiltered || matches(e, query.trim().toLowerCase()))
    .sort((a, b) => {
      const ad = a.e.date || "";
      const bd = b.e.date || "";
      if (ad === bd) return 0;
      if (sortOrder === "asc")  return ad < bd ? -1 : 1;
      return ad > bd ? -1 : 1;
    });

  const add = () => {
    const today = new Date().toISOString().slice(0,10);
    update({ ...etr, daf623a: [{ id: window.AMTR_Store.uid("e"), date: today, type: "", traineeComment: "", traineeInitials: "", trainerComment: "", trainerInitials: "", namtComment: "", namtInitials: "", afmComment: "", afmInitials: "" }, ...entries] });
  };
  const updateRow = (idx, patch) => {
    const next = [...entries]; next[idx] = { ...next[idx], ...patch };
    update({ ...etr, daf623a: next });
  };
  const del = (idx) => { const next = [...entries]; next.splice(idx,1); update({ ...etr, daf623a: next }); };
  const moveRow = (idx, dir) => {
    const target = idx + dir;
    if (target < 0 || target >= entries.length) return;
    const next = [...entries];
    [next[idx], next[target]] = [next[target], next[idx]];
    update({ ...etr, daf623a: next });
  };

  const ENTRY_TYPES = [
    "Quarterly Training Records Inspection",
    "Initial Training",
    "Recurring Training",
    "Monthly Proficiency Training",
    "Trainer Appointment",
    "Certifier Appointment",
    "ALS / PME",
    "AFFSA Message Review",
    "Records Transcription",
    "General Comment",
  ];

  return (
    <div>
      <PageHead crumb="Training Records" title="DAF Form 623A — Individual Training Record" formId="OJT NARRATIVE / SUPERVISOR COMMENTS" action={
        <button className="btn primary" onClick={add} disabled={ro}>+ New entry</button>
      } />

      <div className="ref-block" style={{margin: "0 0 16px"}}>
        <strong>How this works.</strong>{" "}
        Trainee logs the activity (column 1). The Trainer documents on-the-job training (column 2).
        NAMT reviews and signs (column 3). AFM endorses (column 4). Each column may only be
        signed by the member assigned to that role — switch roles in the header to sign your column.
      </div>

      {entries.length === 0 && (
        <Card flush>
          <Empty title="No entries yet" hint='Click "New entry" to log a training activity, inspection, or supervisor comment.' />
        </Card>
      )}

      {entries.length > 0 && (
        <Card flush style={{marginBottom: 14}}>
          <div style={{display:"flex", alignItems:"center", gap: 12, padding: "10px 14px", flexWrap:"wrap"}}>
            <div style={{position:"relative", flex:"1 1 240px", minWidth: 200}}>
              <input
                type="text"
                value={query}
                onChange={(ev)=>setQuery(ev.target.value)}
                placeholder="Search by type, comment text, initials, or date…"
                style={{width:"100%", padding:"7px 28px 7px 30px", borderRadius:"var(--r-sm)", border:"1px solid var(--line)", fontFamily:"inherit", fontSize:13}}
              />
              <span style={{position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"var(--muted-2)", fontSize:13, pointerEvents:"none"}} aria-hidden="true">⌕</span>
              {query && (
                <button type="button" onClick={()=>setQuery("")} title="Clear search"
                  style={{position:"absolute", right:6, top:"50%", transform:"translateY(-50%)", border:"none", background:"transparent", color:"var(--muted)", cursor:"pointer", fontSize:14, lineHeight:1, padding:4}} aria-label="Clear search">×</button>
              )}
            </div>
            <div style={{display:"inline-flex", border:"1px solid var(--line)", borderRadius:"var(--r-sm)", overflow:"hidden", background:"#fff"}} role="group" aria-label="Sort entries by date">
              <button type="button"
                className="btn small"
                onClick={()=>setSortOrder("desc")}
                style={{borderRadius:0, border:"none", borderRight:"1px solid var(--line)", background: sortOrder==="desc" ? "var(--navy-700)" : "#fff", color: sortOrder==="desc" ? "#fff" : "var(--ink-2)", fontWeight: sortOrder==="desc" ? 600 : 500}}
                title="Newest entries at the top">↓ Newest</button>
              <button type="button"
                className="btn small"
                onClick={()=>setSortOrder("asc")}
                style={{borderRadius:0, border:"none", background: sortOrder==="asc" ? "var(--navy-700)" : "#fff", color: sortOrder==="asc" ? "#fff" : "var(--ink-2)", fontWeight: sortOrder==="asc" ? 600 : 500}}
                title="Oldest entries at the top">↑ Oldest</button>
            </div>
            <span className="muted small" style={{marginLeft:"auto", fontFamily:"var(--font-mono)"}}>
              {isFiltered ? `${visible.length} of ${entries.length}` : `${entries.length} entries`}
            </span>
          </div>
        </Card>
      )}

      {entries.length > 0 && visible.length === 0 && (
        <Card flush>
          <Empty title="No matching entries" hint="Adjust the search above or clear it to see every entry." />
        </Card>
      )}

      {visible.map(({ e, origIdx }) => {
        const idx = origIdx;
        const isTrainee = role === "trainee";
        const isTrainer = role === "trainer";
        const isNamt = role === "namt";
        const isAfm = role === "afm";
        const isOpen = !!expanded[e.id];
        return (
          <Card key={e.id}>
            <div style={{display:"grid", gridTemplateColumns: (canReorder && !isFiltered && sortOrder === "desc" ? "160px 1fr auto auto 40px" : "160px 1fr auto 40px"), gap: 14, marginBottom: isOpen ? 12 : 0, alignItems: "flex-end"}}>
              <div className="field">
                <label>Date</label>
                <input type="date" value={e.date||""} onChange={(ev)=>updateRow(idx,{date: ev.target.value})} />
              </div>
              <div className="field">
                <label>Entry Type</label>
                <EntryTypeCombo
                  value={e.type}
                  onChange={(v) => updateRow(idx, { type: v })}
                  options={ENTRY_TYPES}
                  placeholder="Type or pick…"
                />
              </div>
              <div style={{paddingBottom: 2}}>
                <button
                  type="button"
                  className="btn"
                  onClick={()=>toggleExpanded(e.id)}
                  aria-expanded={isOpen}
                  title={isOpen ? "Hide details" : "Show details"}
                >
                  {isOpen ? "▾ Hide details" : "▸ Show details"}
                </button>
              </div>
              {canReorder && !isFiltered && sortOrder === "desc" && (
                <div style={{paddingBottom: 2}}>
                  <div className="reorder-stack">
                    <button
                      type="button"
                      className="icon-arrow"
                      onClick={()=>moveRow(idx,-1)}
                      disabled={idx === 0}
                      title="Move entry up"
                      aria-label="Move entry up"
                    >▲</button>
                    <button
                      type="button"
                      className="icon-arrow"
                      onClick={()=>moveRow(idx,1)}
                      disabled={idx === entries.length - 1}
                      title="Move entry down"
                      aria-label="Move entry down"
                    >▼</button>
                  </div>
                </div>
              )}
              <div className="right">
                <DeleteRowBtn onClick={()=>del(idx)} disabled={isTrainee} title={isTrainee ? "Trainee cannot delete entries" : "Delete entry"} />
              </div>
            </div>

            {isOpen && (
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap: 14}}>
              <div className="field">
                <label>Trainee comment</label>
                <textarea rows={4} value={e.traineeComment||""}
                  onChange={(ev)=>updateRow(idx,{traineeComment: ev.target.value})}
                  disabled={!isTrainee}
                  title={!isTrainee ? "Only the Trainee role can sign this column" : ""}
                  placeholder="What was worked on, started, or completed…" />
                <div style={{display:"flex", gap: 8, alignItems:"center", marginTop: 4}}>
                  <input type="text" value={e.traineeInitials||""}
                    onChange={(ev)=>updateRow(idx,{traineeInitials: ev.target.value.toUpperCase()})}
                    disabled={!isTrainee}
                    title={!isTrainee ? "Only the Trainee role can sign this column" : ""}
                    placeholder="Initials"
                    style={{width: 80, fontFamily: "var(--font-mono)", textAlign:"center"}} />
                  <span className="muted small">Trainee signature</span>
                </div>
              </div>

              <div className="field">
                <label>Trainer comment</label>
                <textarea rows={4} value={e.trainerComment||""}
                  onChange={(ev)=>updateRow(idx,{trainerComment: ev.target.value})}
                  disabled={!isTrainer}
                  title={!isTrainer ? "Only the Trainer role can sign this column" : ""}
                  placeholder="On-the-job training notes / direction" />
                <div style={{display:"flex", gap: 8, alignItems:"center", marginTop: 4}}>
                  <input type="text" value={e.trainerInitials||""}
                    onChange={(ev)=>updateRow(idx,{trainerInitials: ev.target.value.toUpperCase()})}
                    disabled={!isTrainer}
                    title={!isTrainer ? "Only the Trainer role can sign this column" : ""}
                    placeholder="Initials"
                    style={{width: 80, fontFamily: "var(--font-mono)", textAlign:"center"}} />
                  <span className="muted small">Trainer signature</span>
                </div>
              </div>

              <div className="field">
                <label>NAMT comment</label>
                <textarea rows={4} value={e.namtComment||""}
                  onChange={(ev)=>updateRow(idx,{namtComment: ev.target.value})}
                  disabled={!isNamt}
                  title={!isNamt ? "Only the NAMT role can sign this column" : ""}
                  placeholder="NAMT review / direction" />
                <div style={{display:"flex", gap: 8, alignItems:"center", marginTop: 4}}>
                  <input type="text" value={e.namtInitials||""}
                    onChange={(ev)=>updateRow(idx,{namtInitials: ev.target.value.toUpperCase()})}
                    disabled={!isNamt}
                    title={!isNamt ? "Only the NAMT role can sign this column" : ""}
                    placeholder="Initials"
                    style={{width: 80, fontFamily: "var(--font-mono)", textAlign:"center"}} />
                  <span className="muted small">NAMT signature</span>
                </div>
              </div>

              <div className="field">
                <label>AFM comment</label>
                <textarea rows={4} value={e.afmComment||""}
                  onChange={(ev)=>updateRow(idx,{afmComment: ev.target.value})}
                  disabled={!isAfm}
                  title={!isAfm ? "Only the AFM role can sign this column" : ""}
                  placeholder="AFM review / endorsement" />
                <div style={{display:"flex", gap: 8, alignItems:"center", marginTop: 4}}>
                  <input type="text" value={e.afmInitials||""}
                    onChange={(ev)=>updateRow(idx,{afmInitials: ev.target.value.toUpperCase()})}
                    disabled={!isAfm}
                    title={!isAfm ? "Only the AFM role can sign this column" : ""}
                    placeholder="Initials"
                    style={{width: 80, fontFamily: "var(--font-mono)", textAlign:"center"}} />
                  <span className="muted small">AFM signature</span>
                </div>
              </div>
            </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

window.Tab623A = Tab623A;
