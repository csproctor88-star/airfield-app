/* global React */
// Ready Airman Training (GMT)

window.ratStatus = ratStatus;
function ratStatus(it) {
  if (it.completed) return "Complete";
  if (it.due) {
    const today = new Date(); today.setHours(0,0,0,0);
    const dueDate = new Date(it.due + "T00:00:00");
    if (dueDate < today) return "Overdue";
    const days = Math.round((dueDate - today) / 86400000);
    if (days <= 30) return "Due Soon";
    return "Upcoming";
  }
  return "Upcoming";
}

function TabRAT({ etr, update, role }) {
  const ro = role === "trainee";
  const data = etr.rat;
  const items = data.items || [];
  const { useState } = React;
  const [filter, setFilter] = useState("All");

  const setItems = (next) => update({ ...etr, rat: { ...data, items: next } });
  const updateRow = (idx, patch) => { const next = [...items]; next[idx] = { ...next[idx], ...patch }; setItems(next); };
  const del = (idx) => { const next = [...items]; next.splice(idx,1); setItems(next); };
  const add = () => setItems([...items, { id: window.AMTR_Store.uid("rat"), course: "", completed: "", due: "", method: "CBT" }]);

  const filtered = filter === "All" ? items : items.filter(i => ratStatus(i) === filter);
  const counts = items.reduce((a,i)=>{ const s = ratStatus(i); a[s] = (a[s]||0)+1; return a; }, {});
  const complete = counts.Complete || 0;
  const pct = items.length ? Math.round((complete / items.length) * 100) : 0;

  return (
    <div>
      <PageHead crumb="Recurring Training" title="Ready Airman Training" formId="GENERAL MILITARY TRAINING" />

      <div className="metric-grid metric-grid-4">
        <div className="metric"><div className="lbl">Required</div><div className="val">{items.length}</div></div>
        <div className="metric ok"><div className="lbl">Complete</div><div className="val">{counts.Complete||0}</div></div>
        <div className="metric warn"><div className="lbl">Due Soon</div><div className="val">{counts["Due Soon"]||0}</div></div>
        <div className="metric bad"><div className="lbl">Overdue</div><div className="val">{counts.Overdue||0}</div></div>
      </div>

      <Card>
        <div style={{display:"flex", alignItems:"center", gap: 12}}>
          <div className="prog" style={{flex: 1}}><div className="bar" style={{width: pct+"%"}}></div></div>
          <span className="mono small" style={{color: "var(--ink-2)", fontWeight: 600}}>{pct}% complete · {complete} of {items.length}</span>
        </div>
      </Card>

      <Card flush>
        <div className="filter-bar">
          {["All","Complete","Due Soon","Overdue"].map(f => (
            <button key={f} className={"filter-btn " + (filter===f?"active":"")} onClick={()=>setFilter(f)}>
              {f} {f !== "All" && <span className="muted">({counts[f]||0})</span>}
            </button>
          ))}
          <div style={{marginLeft: "auto"}}>
            <button className="btn primary small" onClick={add} disabled={ro}>+ Add course</button>
          </div>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Course Title</th>
                <th style={{width: 130}}>Completed</th>
                <th style={{width: 130}}>Due Date</th>
                <th style={{width: 110}}>Method</th>
                <th style={{width: 110}}>Status</th>
                <th style={{width: 40}}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it, idx) => {
                const realIdx = items.indexOf(it);
                return (
                  <tr key={it.id}>
                    <td><EditableInput value={it.course} onChange={(v)=>updateRow(realIdx,{course:v})} readOnly={ro} placeholder="Course name" /></td>
                    <td><input type="date" className="cell-input mono" value={it.completed||""} disabled={ro} onChange={(ev)=>updateRow(realIdx,{completed: ev.target.value})} /></td>
                    <td><input type="date" className="cell-input mono" value={it.due||""} disabled={ro} onChange={(ev)=>updateRow(realIdx,{due: ev.target.value})} /></td>
                    <td>
                      <select className="cell-input" value={it.method||""} disabled={ro} onChange={(ev)=>updateRow(realIdx,{method: ev.target.value})}>
                        <option>CBT</option>
                        <option>Read</option>
                        <option>Hands-on</option>
                        <option>Brief</option>
                      </select>
                    </td>
                    <td>
                      {(() => {
                        const s = ratStatus(it);
                        const cls = s === "Complete" ? "yes" : s === "Overdue" ? "no" : s === "Due Soon" ? "warn" : "";
                        return (
                          <span className={"yn-pill " + cls} title="Auto-set from Completed / Due dates">{s}</span>
                        );
                      })()}
                    </td>
                    <td className="right"><DeleteRowBtn onClick={()=>del(realIdx)} disabled={ro} /></td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6}><Empty title="No courses match this filter" hint="Switch filters or add a course." /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

window.TabRAT = TabRAT;
