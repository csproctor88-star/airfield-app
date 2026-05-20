/* global React */
// DAF Form 1098 — Recurring Training.
// Catalog (task title, type, frequency, years) is shared at the org level (state.rt1098).
// Per-member fields (Start, Complete, Next Due, Initials, Score/Hours) live on etr.daf1098Progress.
// NAMT/AFM toggle catalog edit mode from the page header — same pattern as JQS-CFETP.

const { useState: useState1098 } = React;

// Compute the next due date from a complete (YYYY-MM-DD) date and a frequency label.
function computeNextDue(completeDate, frequency) {
  if (!completeDate) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(completeDate);
  if (!m) return "";
  const y = parseInt(m[1], 10), mo = parseInt(m[2], 10) - 1, d = parseInt(m[3], 10);
  const dt = new Date(y, mo, d);
  switch (frequency) {
    case "Monthly":     dt.setMonth(dt.getMonth() + 1); break;
    case "Quarterly":   dt.setMonth(dt.getMonth() + 3); break;
    case "Semi-Annual": dt.setMonth(dt.getMonth() + 6); break;
    case "Annual":      dt.setFullYear(dt.getFullYear() + 1); break;
    case "2 Years":     dt.setFullYear(dt.getFullYear() + 2); break;
    case "3 Years":     dt.setFullYear(dt.getFullYear() + 3); break;
    case "5 Years":     dt.setFullYear(dt.getFullYear() + 5); break;
    default: return "";
  }
  const pad = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`;
}

window.rt1098Status = rt1098Status;
function rt1098Status(p) {
  if (!p) return "";
  const today = new Date(); today.setHours(0,0,0,0);
  const due = p.nextDue ? new Date(p.nextDue + "T00:00:00") : null;
  if (due) {
    const days = Math.round((due - today) / 86400000);
    if (days < 0) return "Overdue";
    if (days <= 30) return "Due Soon";
    if (p.lastCompleted) return "Complete";
    return "Upcoming";
  }
  if (p.lastCompleted) return "Complete";
  return "";
}

function rt1098RowClass(status) {
  if (status === "Complete") return "row-complete";
  if (status === "Due Soon") return "row-warn";
  if (status === "Overdue") return "row-overdue";
  return "";
}

function Tab1098({ etr, update, role, rt1098, setRt1098 }) {
  const ro = role === "trainee";
  const isAdmin = role === "namt" || role === "afm";
  const [editingCatalog, setEditingCatalog] = useState1098(false);
  // Snapshot the catalog when entering edit mode so Cancel can roll back.
  const [editSnapshot, setEditSnapshot] = useState1098(null);
  const canEditCatalog = isAdmin && editingCatalog;
  const canReorder = canEditCatalog;
  const canManageYears = canEditCatalog;

  // Drag-and-drop row reorder (catalog edit mode).
  const [dragIdx, setDragIdx] = useState1098(null);
  const [dropIdx, setDropIdx] = useState1098(null);
  const onDragStart = (idx) => (e) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", String(idx)); } catch (_) {}
  };
  const onDragOverRow = (idx) => (e) => {
    if (dragIdx === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const t = e.clientY < rect.top + rect.height / 2 ? idx : idx + 1;
    if (t !== dropIdx) setDropIdx(t);
  };
  const onDropRow = (e) => {
    e.preventDefault();
    if (dragIdx === null || dropIdx === null) { setDragIdx(null); setDropIdx(null); return; }
    let from = dragIdx, to = dropIdx;
    if (to > from) to -= 1;
    if (from !== to) {
      setRt1098(s => {
        const next = { ...s, tasks: s.tasks.slice() };
        const [moved] = next.tasks.splice(from, 1);
        next.tasks.splice(to, 0, moved);
        return next;
      });
    }
    setDragIdx(null); setDropIdx(null);
  };
  const onDragEndRow = () => { setDragIdx(null); setDropIdx(null); };

  const tasks = rt1098.tasks || [];
  const years = rt1098.years || [];
  const initialActive = rt1098.currentYear || years[0] || "2026";
  const [active, setActive] = useState1098(initialActive);
  const currentYear = years.includes(active) ? active : (years[0] || initialActive);

  // Per-member progress for this year, keyed by task.id
  const progress = (etr.daf1098Progress && etr.daf1098Progress[currentYear]) || {};

  // ---- catalog mutations (NAMT/AFM, edit mode) ----
  const patchTask = (idx, patch) => {
    setRt1098(s => {
      const next = { ...s, tasks: s.tasks.slice() };
      next.tasks[idx] = { ...next.tasks[idx], ...patch };
      return next;
    });
  };
  const addTask = () => {
    setRt1098(s => ({
      ...s,
      tasks: [...s.tasks, { id: window.AMTR_Store.uid("rt"), task: "", type: "", frequency: "Annual" }],
    }));
  };
  const deleteTask = (idx) => {
    if (!confirm(`Delete task "${tasks[idx].task}"? Per-member progress on this task will be hidden.`)) return;
    const taskId = tasks[idx].id;
    setRt1098(s => {
      const next = { ...s, tasks: s.tasks.slice() };
      next.tasks.splice(idx, 1);
      return next;
    });
    // (We don't bulk-prune per-member progress; it just becomes orphaned and ignored.)
  };
  const moveTask = (idx, dir) => {
    const target = idx + dir;
    if (target < 0 || target >= tasks.length) return;
    setRt1098(s => {
      const next = { ...s, tasks: s.tasks.slice() };
      [next.tasks[idx], next.tasks[target]] = [next.tasks[target], next.tasks[idx]];
      return next;
    });
  };
  const addYear = () => {
    const y = prompt("New year (YYYY):", String(parseInt(currentYear || "2026", 10) + 1));
    if (!y) return;
    if (years.includes(y)) { alert(`Year ${y} already exists.`); return; }
    setRt1098(s => {
      const ys = [y, ...s.years].sort().reverse();
      return { ...s, years: ys };
    });
    setActive(y);
  };
  const deleteYear = () => {
    if (years.length <= 1) { alert("At least one year must remain."); return; }
    if (!confirm(`Delete year ${currentYear}? All recurring-training progress logged for this year (across every member) will be removed.`)) return;
    setRt1098(s => {
      const ys = s.years.filter(y => y !== currentYear);
      return { ...s, years: ys, currentYear: ys[0] };
    });
    setActive(years.find(y => y !== currentYear) || "");
  };

  // ---- per-member progress mutations ----
  const setProgress = (taskId, patch) => {
    const yearProgress = (etr.daf1098Progress && etr.daf1098Progress[currentYear]) || {};
    const merged = { ...(yearProgress[taskId] || {}), ...patch };
    const cleaned = Object.fromEntries(Object.entries(merged).filter(([_, v]) => v !== "" && v != null));
    const nextYearProgress = { ...yearProgress };
    if (Object.keys(cleaned).length === 0) {
      delete nextYearProgress[taskId];
    } else {
      nextYearProgress[taskId] = cleaned;
    }
    update({
      ...etr,
      daf1098Progress: {
        ...(etr.daf1098Progress || {}),
        [currentYear]: nextYearProgress,
      },
    });
  };

  // ---- computed counts (status for THIS year) ----
  const counts = tasks.reduce((acc, t) => {
    const s = rt1098Status(progress[t.id]);
    if (s) acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <PageHead
        crumb="Recurring Training"
        title="DAF Form 1098 — Special Task Certification & Recurring Training"
        formId="ANNUAL & MONTHLY REQUIREMENTS"
        action={isAdmin ? (
          editingCatalog
            ? (
              <div style={{display:"flex", gap:8}}>
                <button className="btn" onClick={() => {
                  if (editSnapshot && JSON.stringify(editSnapshot) !== JSON.stringify(rt1098)) {
                    if (!confirm("Discard catalog changes since you entered edit mode?")) return;
                    setRt1098(() => editSnapshot);
                  }
                  setEditSnapshot(null);
                  setEditingCatalog(false);
                }} title="Discard changes and exit edit mode">✕ Cancel</button>
                <button className="btn primary" onClick={() => { setEditSnapshot(null); setEditingCatalog(false); }} title="Keep changes and exit edit mode">✓ Save & Exit</button>
              </div>
            )
            : <button className="btn" onClick={() => { setEditSnapshot(JSON.parse(JSON.stringify(rt1098))); setEditingCatalog(true); }} title="Enter catalog edit mode — add/rename tasks, manage years">✎ Edit catalog</button>
        ) : null}
      />

      {editingCatalog && (
        <div className="jqs-edit-banner">
          <span className="dot"></span>
          <span><strong>Catalog edit mode.</strong> You can add/rename/delete tasks and add/remove years. These changes apply to <em>every</em> member's record. Click <em>Save & Exit</em> to keep changes, or <em>Cancel</em> to discard.</span>
        </div>
      )}

      <div className="metric-grid metric-grid-4">
        <div className="metric"><div className="lbl">Required</div><div className="val">{tasks.length}</div></div>
        <div className="metric ok"><div className="lbl">Complete</div><div className="val">{counts.Complete||0}</div></div>
        <div className="metric warn"><div className="lbl">Due Soon</div><div className="val">{counts["Due Soon"]||0}</div></div>
        <div className="metric bad"><div className="lbl">Overdue</div><div className="val">{counts.Overdue||0}</div></div>
      </div>

      <Card flush>
        <div className="subnav">
          {years.map(y => (
            <button key={y} className={currentYear===y?"active":""} onClick={()=>setActive(y)}>{y}</button>
          ))}
          {canManageYears && (
            <div style={{display: "flex", gap: 6, margin: "8px 8px 8px auto"}}>
              <button className="btn small ghost" onClick={addYear} title="Add new year">+ New year</button>
              <button className="btn small ghost" onClick={deleteYear} disabled={years.length<=1} title="Delete current year">− Delete year</button>
            </div>
          )}
        </div>

        <div className="tbl-wrap">
          <table className="tbl tbl-fit">
            <colgroup>
              <col style={{width: canEditCatalog ? "21%" : "21%"}} />
              <col style={{width: "9%"}} />
              <col style={{width: "9%"}} />
              <col style={{width: "10%"}} />
              <col style={{width: "8%"}} />
              <col style={{width: "9%"}} />
              <col style={{width: "10%"}} />
              <col style={{width: "9%"}} />
              <col style={{width: "9%"}} />
              {canReorder && <col style={{width: "5%"}} />}
              {canEditCatalog && <col style={{width: "5%"}} />}
            </colgroup>
            <thead>
              <tr>
                <th>Task Title</th>
                <th>Start Date</th>
                <th>Complete Date</th>
                <th>Certifying Official Initials</th>
                <th>Trainee Initials</th>
                <th>Score or Hours</th>
                <th>Type</th>
                <th>Frequency</th>
                <th>Due Date</th>
                {canReorder && <th></th>}
                {canEditCatalog && <th></th>}
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 && (
                <tr><td colSpan={canEditCatalog ? 11 : 9}>
                  <Empty
                    title="No recurring tasks defined"
                    hint={canEditCatalog ? "Add the first task with the button below." : "An admin (NAMT/AFM) needs to add tasks in catalog edit mode."}
                  />
                </td></tr>
              )}
              {tasks.map((t, idx) => {
                const p = progress[t.id] || {};
                const status = rt1098Status(p);
                const rowClass = rt1098RowClass(status);
                return (
                <tr key={t.id}
                  className={[
                    rowClass,
                    dragIdx === idx ? "row-dragging" : "",
                    dropIdx === idx ? "row-drop-target" : "",
                    dropIdx === tasks.length && idx === tasks.length - 1 ? "row-drop-target-end" : "",
                  ].filter(Boolean).join(" ")}
                  onDragOver={canReorder ? onDragOverRow(idx) : undefined}
                  onDrop={canReorder ? onDropRow : undefined}
                  onDragEnd={canReorder ? onDragEndRow : undefined}
                >
                  {/* Task Title — catalog field */}
                  <td>
                    {canEditCatalog
                      ? <EditableInput value={t.task} onChange={(v)=>patchTask(idx,{task:v})} placeholder="Task title" />
                      : <div style={{padding: "0 8px"}}>{t.task || <span className="muted">—</span>}</div>
                    }
                  </td>
                  {/* Per-member: Start Date */}
                  <td>
                    <input type="date" className="cell-input mono" value={p.startDate||""} disabled={ro}
                      onChange={(ev)=>setProgress(t.id, {startDate: ev.target.value})} />
                  </td>
                  {/* Per-member: Complete Date */}
                  <td>
                    <input type="date" className="cell-input mono" value={p.lastCompleted||""} disabled={ro}
                      onChange={(ev)=>{
                        const v = ev.target.value;
                        const due = computeNextDue(v, t.frequency);
                        setProgress(t.id, {lastCompleted: v, nextDue: due || p.nextDue || ""});
                      }} />
                  </td>
                  {/* Per-member: Certifier Initials */}
                  <td>
                    <EditableInput mono value={p.certifier} onChange={(v)=>setProgress(t.id,{certifier: v.toUpperCase()})} readOnly={ro} placeholder="Init" />
                  </td>
                  {/* Per-member: Trainee Initials */}
                  <td>
                    <EditableInput mono value={p.traineeInitials} onChange={(v)=>setProgress(t.id,{traineeInitials: v.toUpperCase()})} placeholder="Init" />
                  </td>
                  {/* Catalog: Score or Hours */}
                  <td>
                    {canEditCatalog
                      ? <EditableInput value={t.scoreOrHours} onChange={(v)=>patchTask(idx,{scoreOrHours:v})} placeholder="e.g. 92% / 2.5 hrs" />
                      : <div style={{padding: "0 8px"}}>{t.scoreOrHours || ""}</div>
                    }
                  </td>
                  {/* Catalog: Type */}
                  <td>
                    {canEditCatalog
                      ? <EditableInput value={t.type} onChange={(v)=>patchTask(idx,{type: v})} placeholder="e.g. CBT, Hands-on" />
                      : <div style={{padding: "0 8px"}}>{t.type || ""}</div>
                    }
                  </td>
                  {/* Catalog: Frequency */}
                  <td>
                    {canEditCatalog ? (
                      <select className="cell-input" value={t.frequency||""} onChange={(ev)=>patchTask(idx,{frequency: ev.target.value})}>
                        <option>Annual</option>
                        <option>Semi-Annual</option>
                        <option>Quarterly</option>
                        <option>Monthly</option>
                        <option>2 Years</option>
                        <option>3 Years</option>
                        <option>5 Years</option>
                      </select>
                    ) : (
                      <div style={{padding: "0 8px"}}>{t.frequency || ""}</div>
                    )}
                  </td>
                  {/* Per-member: Due Date */}
                  <td>
                    <input type="date" className="cell-input mono" value={p.nextDue||""} disabled={ro}
                      onChange={(ev)=>setProgress(t.id, {nextDue: ev.target.value})} />
                  </td>
                  {canReorder && (
                    <td className="drag-handle-cell"
                       draggable
                       onDragStart={onDragStart(idx)}
                       title="Drag to reorder"
                    >
                      <span className="drag-handle-grip" aria-label="Drag to reorder">⋮⋮</span>
                    </td>
                  )}
                  {canEditCatalog && (
                    <td className="right">
                      <DeleteRowBtn onClick={()=>deleteTask(idx)} title="Delete task" />
                    </td>
                  )}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {canEditCatalog && <AddRowBtn onClick={addTask} label="Add recurring task" />}
      </Card>
    </div>
  );
}

window.Tab1098 = Tab1098;
