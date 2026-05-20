/* global React */
// DAF Form 797 — Task Certification Log

const { useState } = React;

// Same milestone-window choices the QTP/PCG Milestone tabs use, so this column
// reads identically across forms.
const TASK_797_MILESTONES = ["1-30 Days", "30-60 Days", "60-90 Days", "90-120 Days", "120-180 Days"];

function Tab797({ etr, update, role }) {
  const ro = role === "trainee";
  const canReorder = role === "namt" || role === "afm";
  const entries = etr.daf797 || [];

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ task: "", requiresCertifier: true });

  const commitAdd = () => {
    const title = (draft.task || "").trim();
    if (!title) return;
    const next = [...entries, {
      id: window.AMTR_Store.uid("t"),
      task: title,
      requiresCertifier: !!draft.requiresCertifier,
      startDate: "",
      completeDate: "",
      traineeInitials: "",
      trainerInitials: "",
      certifierInitials: "",
      milestones: "",
    }];
    update({ ...etr, daf797: next });
    setDraft({ task: "", requiresCertifier: true });
    setAdding(false);
  };

  const updateRow = (idx, patch) => {
    const next = [...entries];
    next[idx] = { ...next[idx], ...patch };
    update({ ...etr, daf797: next });
  };
  const del = (idx) => {
    const next = [...entries];
    next.splice(idx, 1);
    update({ ...etr, daf797: next });
  };
  const moveRow = (idx, dir) => {
    const target = idx + dir;
    if (target < 0 || target >= entries.length) return;
    const next = [...entries];
    [next[idx], next[target]] = [next[target], next[idx]];
    update({ ...etr, daf797: next });
  };

  return (
    <div>
      <PageHead crumb="Training Records" title="DAF Form 797 — Job Qualification Standard Continuation / Command JQS" formId="TASK CERTIFICATION LOG" />

      <div className="ref-block" style={{margin: "0 0 16px"}}>
        Use this tab for individuals in <strong>local qualification training</strong>. If previously completed in AFTR or prior to the current local training guide, transcribe IAW the 1C7 CFETP, complete training for new items, and attach exported record in the Files tab.
      </div>

      <Card
        flush
        action={!adding && <button className="btn primary" onClick={() => setAdding(true)} disabled={ro}>+ Add task</button>}
        title={`Task Log (${entries.length})`}
      >
        {adding && (
          <div className="new-task-form">
            <div className="new-task-form-row">
              <div className="field" style={{flex: "1 1 auto"}}>
                <label>Task Title</label>
                <input
                  type="text"
                  autoFocus
                  value={draft.task}
                  placeholder="e.g. 7.7.1. Perform Airfield Driving Procedures"
                  onChange={(e) => setDraft({ ...draft, task: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") commitAdd(); if (e.key === "Escape") setAdding(false); }}
                />
              </div>
              <label className="cert-toggle">
                <input
                  type="checkbox"
                  checked={!!draft.requiresCertifier}
                  onChange={(e) => setDraft({ ...draft, requiresCertifier: e.target.checked })}
                />
                <span>Requires certifier initials</span>
              </label>
              <div className="new-task-actions">
                <button className="btn" onClick={() => { setAdding(false); setDraft({ task: "", requiresCertifier: true }); }}>Cancel</button>
                <button className="btn primary" onClick={commitAdd} disabled={!draft.task.trim()}>Add task</button>
              </div>
            </div>
            <div className="new-task-hint">
              Uncheck <em>Requires certifier initials</em> for tasks signed off by the trainer alone (no separate certifier sign-off required).
            </div>
          </div>
        )}

        <div className="tbl-wrap">
          <table className="tbl tbl-fit">
            <thead>
              <tr>
                <th>Task Title</th>
                <th style={{width: 130}}>Start Date</th>
                <th style={{width: 130}}>Complete Date</th>
                <th style={{width: 90}}>Trainee Initials</th>
                <th style={{width: 90}}>Trainer Initials</th>
                <th style={{width: 110}}>Certifier Initials</th>
                <th style={{width: 180}}>Local Milestones</th>
                {canReorder && <th style={{width: 40}}></th>}
                <th style={{width: 36}}></th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && !adding && (
                <tr><td colSpan={canReorder ? 9 : 8}><Empty title="No tasks logged yet" hint='Add the first task certification with the button above.' /></td></tr>
              )}
              {entries.map((e, idx) => (
                <tr key={e.id}>
                  <td>
                    <EditableInput
                      value={e.task}
                      onChange={(v) => updateRow(idx, { task: v })}
                      readOnly={ro}
                      placeholder="Task title"
                    />
                  </td>
                  <td>
                    <input
                      type="date"
                      className="cell-input mono"
                      value={e.startDate || ""}
                      disabled={ro}
                      onChange={(ev) => updateRow(idx, { startDate: ev.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="date"
                      className="cell-input mono"
                      value={e.completeDate || ""}
                      disabled={ro}
                      onChange={(ev) => updateRow(idx, { completeDate: ev.target.value })}
                    />
                  </td>
                  <td>
                    <EditableInput
                      mono
                      value={e.traineeInitials}
                      onChange={(v) => updateRow(idx, { traineeInitials: v.toUpperCase() })}
                      placeholder="Init"
                    />
                  </td>
                  <td>
                    <EditableInput
                      mono
                      value={e.trainerInitials}
                      onChange={(v) => updateRow(idx, { trainerInitials: v.toUpperCase() })}
                      readOnly={ro}
                      placeholder="Init"
                    />
                  </td>
                  <td>
                    {e.requiresCertifier === false ? (
                      <span className="na-cell" title="This task does not require a separate certifier sign-off">N/A</span>
                    ) : (
                      <EditableInput
                        mono
                        value={e.certifierInitials}
                        onChange={(v) => updateRow(idx, { certifierInitials: v.toUpperCase() })}
                        readOnly={ro}
                        placeholder="Init"
                      />
                    )}
                  </td>
                  <td>
                    <select
                      className="cell-input"
                      value={e.milestones || ""}
                      disabled={ro}
                      onChange={(ev) => updateRow(idx, { milestones: ev.target.value })}
                    >
                      <option value="">—</option>
                      {TASK_797_MILESTONES.map(w => <option key={w} value={w}>{w}</option>)}
                    </select>
                  </td>
                  {canReorder && (
                    <td className="reorder-cell">
                      <div className="reorder-stack">
                        <button
                          type="button"
                          className="icon-arrow"
                          onClick={()=>moveRow(idx,-1)}
                          disabled={idx === 0}
                          title="Move up"
                          aria-label="Move row up"
                        >▲</button>
                        <button
                          type="button"
                          className="icon-arrow"
                          onClick={()=>moveRow(idx,1)}
                          disabled={idx === entries.length - 1}
                          title="Move down"
                          aria-label="Move row down"
                        >▼</button>
                      </div>
                    </td>
                  )}
                  <td className="right"><DeleteRowBtn onClick={() => del(idx)} disabled={ro} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

window.Tab797 = Tab797;
