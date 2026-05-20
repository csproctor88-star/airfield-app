/* global React */
// DAF Form 803 — Task Performance Evaluation
// One unified tab with sub-sections: Apprentice Grad, AMSL/AMOS, 5-Level, 7-Level, AFM
// Each section is its own task list with proficiency codes + dual sign-off.

const SECTIONS_803 = [
  { key: "apprenticeGrad", label: "Apprentice Grad",  desc: "Apprentice Graduation — initial qualification entries." },
  { key: "amslAmos",       label: "AMSL / AMOS",      desc: "Airfield Management Shift Lead / Operations Supervisor PCG task evals." },
  { key: "fiveLevel",      label: "5-Level",          desc: "5-Skill Level upgrade training task performance." },
  { key: "sevenLevel",     label: "7-Level",          desc: "7-Skill Level upgrade training task performance." },
  { key: "afm",            label: "AFM",              desc: "Airfield Manager PCG task evals." },
];

function SectionTaskTable({ section, data, onChange, role }) {
  const ro = role === "trainee";
  const tasks = data.tasks || [];

  const add = () => onChange({ ...data, tasks: [...tasks, {
    id: window.AMTR_Store.uid("t"),
    stsItem: "", date: "", inUgt: "", results: "", evaluatorInitials: "",
  }] });
  const updateRow = (idx, patch) => { const next = [...tasks]; next[idx] = { ...next[idx], ...patch }; onChange({ ...data, tasks: next }); };
  const del = (idx) => { const next = [...tasks]; next.splice(idx,1); onChange({ ...data, tasks: next }); };

  return (
    <div>
      <div className="ref-block" style={{margin: 0, borderRadius: 0, borderLeft: 0, borderBottom: "1px solid var(--line-soft)"}}>
        {section.desc}
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>STS Item</th>
              <th style={{width: 150}}>Date</th>
              <th style={{width: 100}}>In UGT?</th>
              <th>Results</th>
              <th style={{width: 140}}>Evaluator Initials</th>
              <th style={{width: 40}}></th>
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 && (
              <tr><td colSpan={6}>
                <Empty title="No task evaluations yet" hint='Add the first 803 task entry with the button below.' />
              </td></tr>
            )}
            {tasks.map((t, idx) => {
              const isUnsat = t.results === "UNSAT";
              const needsComment = isUnsat && !(t.unsatComment||"").trim();
              return (
              <React.Fragment key={t.id}>
              <tr>
                <td><EditableInput mono value={t.stsItem} onChange={(v)=>updateRow(idx,{stsItem:v})} readOnly={ro} placeholder="e.g. 7.5.1" /></td>
                <td><input type="date" className="cell-input mono" value={t.date||""} disabled={ro} onChange={(ev)=>updateRow(idx,{date: ev.target.value})} /></td>
                <td>
                  <select
                    className={"yn-select " + (t.inUgt==="Yes"?"yes":t.inUgt==="No"?"no":"")}
                    value={t.inUgt||""} disabled={ro}
                    onChange={(ev)=>updateRow(idx,{inUgt: ev.target.value})}>
                    <option value=""></option>
                    <option>Yes</option>
                    <option>No</option>
                  </select>
                </td>
                <td>
                  <select
                    className={"yn-select " + (t.results==="SAT"?"yes":t.results==="UNSAT"?"no":"")}
                    value={t.results||""} disabled={ro}
                    onChange={(ev)=>updateRow(idx,{results: ev.target.value})}>
                    <option value=""></option>
                    <option>SAT</option>
                    <option>UNSAT</option>
                  </select>
                </td>
                <td><EditableInput mono value={t.evaluatorInitials} onChange={(v)=>updateRow(idx,{evaluatorInitials: v.toUpperCase()})} readOnly={ro} placeholder="Init" /></td>
                <td className="right"><DeleteRowBtn onClick={()=>del(idx)} disabled={ro} /></td>
              </tr>
              {isUnsat && (
                <tr className="unsat-row">
                  <td colSpan={6} style={{padding: "10px 12px", background: "var(--bad-bg)", borderTop: "1px dashed rgba(165,33,33,0.35)"}}>
                    <label style={{display:"block", fontSize: 11, fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: "var(--bad)", marginBottom: 4}}>
                      UNSAT — Comment required {needsComment && <span title="Required" style={{marginLeft: 4}}>*</span>}
                    </label>
                    <textarea
                      rows={2}
                      value={t.unsatComment||""}
                      onChange={(ev)=>updateRow(idx,{unsatComment: ev.target.value})}
                      disabled={ro}
                      placeholder="Describe the deficiency, retraining plan, and re-evaluation date."
                      required
                      aria-invalid={needsComment}
                      style={{
                        width: "100%",
                        fontFamily: "inherit",
                        fontSize: 13,
                        padding: 8,
                        border: "1px solid " + (needsComment ? "var(--bad)" : "var(--line)"),
                        borderRadius: "var(--r-sm)",
                        background: "#fff",
                        resize: "vertical",
                      }}
                    />
                    {needsComment && (
                      <div className="small" style={{color: "var(--bad)", marginTop: 4, fontWeight: 600}}>
                        A comment is required for any UNSAT result.
                      </div>
                    )}
                  </td>
                </tr>
              )}
              </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <AddRowBtn onClick={add} label="Add task evaluation" disabled={ro} />
    </div>
  );
}

function Tab803({ etr, update, role }) {
  const { useState } = React;
  const [active, setActive] = useState("apprenticeGrad");
  const d803 = etr.daf803;
  const setSection = (key, data) => update({ ...etr, daf803: { ...d803, [key]: data } });

  const sec = SECTIONS_803.find(s => s.key === active);

  return (
    <div>
      <PageHead crumb="Training Records" title="DAF Form 803 — Report of Task Performance" formId="TASK PERFORMANCE EVALUATIONS" />

      <Card flush>
        <div className="subnav">
          {SECTIONS_803.map((s) => (
            <button key={s.key} className={active===s.key?"active":""} onClick={()=>setActive(s.key)}>
              {s.label}
              <span className="chip" style={{marginLeft: 8, fontSize: 10}}>{(d803[s.key]?.tasks||[]).length}</span>
            </button>
          ))}
        </div>
        <SectionTaskTable
          section={sec}
          data={d803[active]}
          onChange={(v)=>setSection(active, v)}
          role={role}
        />
      </Card>
    </div>
  );
}

window.Tab803 = Tab803;
