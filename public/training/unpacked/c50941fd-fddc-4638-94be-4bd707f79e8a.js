/* global React */
// Qualifications tab — QTP packages (expandable), Yes/No quals, TSC definitions table

const { useState: useStateQ } = React;

function QtpRow({ qtp, update, remove, role, expanded, toggle }) {
  const ro = role === "trainee";
  const setField = (k, v) => update({ ...qtp, [k]: v });
  const addLesson = () => setField("lessons", [...(qtp.lessons||[]), { id: window.AMTR_Store.uid("l"), name: "", startDate: "", completeDate: "" }]);
  const updateLesson = (idx, patch) => {
    const next = [...qtp.lessons]; next[idx] = { ...next[idx], ...patch };
    setField("lessons", next);
  };
  const delLesson = (idx) => {
    const next = [...qtp.lessons]; next.splice(idx,1);
    setField("lessons", next);
  };

  return (
    <>
      <tr>
        <td style={{width: 30}}><ExpandBtn open={expanded} onClick={toggle} /></td>
        <td>
          <EditableInput value={qtp.name} onChange={(v)=>setField("name",v)} readOnly={ro} placeholder="Training package" />
        </td>
        <td style={{width: 160}}>
          <input type="date" className="cell-input mono" value={qtp.completeDate||""} disabled={ro} onChange={(e)=>setField("completeDate", e.target.value)} />
        </td>
        <td style={{width: 110}}>
          {qtp.lessons && qtp.lessons.length
            ? <span className="chip">{qtp.lessons.filter(l=>l.completeDate).length}/{qtp.lessons.length} done</span>
            : <span className="muted small">— no lessons</span>}
        </td>
        <td style={{width: 40}} className="right">
          <DeleteRowBtn onClick={remove} disabled={ro} />
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} className="nested-panel" style={{padding: 0}}>
            <div className="nested-panel">
              <div style={{display:"grid", gridTemplateColumns:"220px 1fr", gap: 14, marginBottom: 12}}>
                <div className="field">
                  <label>Estimated Completion Date</label>
                  <input type="date" value={qtp.ecd||""} disabled={ro} onChange={(e)=>setField("ecd", e.target.value)} />
                </div>
              </div>
              <h4>Lessons</h4>
              <div className="nested-tbl">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Lesson</th>
                      <th style={{width: 160}}>Start Date</th>
                      <th style={{width: 160}}>Completion Date</th>
                      <th style={{width: 40}}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(qtp.lessons||[]).length === 0 && (
                      <tr><td colSpan={4} className="muted small" style={{padding: 12}}>No lessons yet. Add one below.</td></tr>
                    )}
                    {(qtp.lessons||[]).map((l, i) => (
                      <tr key={l.id}>
                        <td><EditableInput value={l.name} onChange={(v)=>updateLesson(i,{name:v})} readOnly={ro} placeholder="Lesson title or STS item(s)" /></td>
                        <td><input type="date" className="cell-input mono" value={l.startDate||""} disabled={role==="trainer"?false:false /* trainee can log start */} onChange={(e)=>updateLesson(i,{startDate: e.target.value})} /></td>
                        <td><input type="date" className="cell-input mono" value={l.completeDate||""} disabled={ro} onChange={(e)=>updateLesson(i,{completeDate: e.target.value})} /></td>
                        <td className="right"><DeleteRowBtn onClick={()=>delLesson(i)} disabled={ro} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{marginTop: 10}}>
                <button className="btn small" onClick={addLesson} disabled={ro}>+ Add lesson</button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function TabQualifications({ etr, update, role }) {
  const ro = role === "trainee";
  const [expanded, setExpanded] = useStateQ({});
  const q = etr.qualifications;
  const setQ = (patch) => update({ ...etr, qualifications: { ...q, ...patch } });

  const addQtp = () => setQ({ qtps: [...q.qtps, { id: window.AMTR_Store.uid("q"), name: "", completeDate: "", ecd: "", lessons: [] }] });
  const updateQtp = (idx, val) => { const next = [...q.qtps]; next[idx] = val; setQ({ qtps: next }); };
  const delQtp = (idx) => { const next = [...q.qtps]; next.splice(idx,1); setQ({ qtps: next }); };

  const addYn = () => setQ({ yesNo: [...q.yesNo, { id: window.AMTR_Store.uid("yn"), name: "", value: "No" }] });
  const updateYn = (idx, patch) => { const next = [...q.yesNo]; next[idx] = { ...next[idx], ...patch }; setQ({ yesNo: next }); };
  const delYn = (idx) => { const next = [...q.yesNo]; next.splice(idx,1); setQ({ yesNo: next }); };

  return (
    <div>
      <PageHead crumb="Qualifications" title="Qualifications" formId="QTP · PCG · Skill Levels · SEIs" />

      <Card title="Qualification Training Packages & Position Certification Guides" sub="QTPs / PCGs with expandable lesson lists" flush>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{width: 30}}></th>
                <th>Training Package</th>
                <th>Complete Date</th>
                <th>Lessons</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {q.qtps.map((qtp, idx) => (
                <QtpRow
                  key={qtp.id}
                  qtp={qtp}
                  update={(v) => updateQtp(idx, v)}
                  remove={() => delQtp(idx)}
                  role={role}
                  expanded={!!expanded[qtp.id]}
                  toggle={() => setExpanded({ ...expanded, [qtp.id]: !expanded[qtp.id] })}
                />
              ))}
            </tbody>
          </table>
        </div>
        <AddRowBtn onClick={addQtp} label="Add training package" disabled={ro} />
      </Card>

      <Card title="Qualifications" sub="Skill levels, Special Experience Identifiers, trainer/certifier status" flush>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Qualification</th>
                <th style={{width: 140}}>Status</th>
                <th style={{width: 200}}>Notes</th>
                <th style={{width: 40}}></th>
              </tr>
            </thead>
            <tbody>
              {q.yesNo.map((yn, idx) => (
                <tr key={yn.id}>
                  <td><EditableInput value={yn.name} onChange={(v)=>updateYn(idx,{name:v})} readOnly={ro} placeholder="Qualification name" /></td>
                  <td><YesNoSelect value={yn.value} onChange={(v)=>updateYn(idx,{value:v})} readOnly={ro} /></td>
                  <td><EditableInput value={yn.notes||""} onChange={(v)=>updateYn(idx,{notes:v})} readOnly={ro} placeholder="Optional date / reference" /></td>
                  <td className="right"><DeleteRowBtn onClick={()=>delYn(idx)} disabled={ro} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <AddRowBtn onClick={addYn} label="Add qualification" disabled={ro} />
      </Card>
    </div>
  );
}

window.TabQualifications = TabQualifications;
