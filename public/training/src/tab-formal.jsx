/* global React */
// Formal Training tab — HAF, Initial, Continuation/Optional groupings.
// Course titles live at the org level (state.formalCatalog) and apply to every
// member. Per-member fields (Start Date, Complete Date) are stored on
// etr.formalTrainingProgress, keyed by catalog course id.
// Title edits, add, delete, and reorder are gated behind the "Edit catalog"
// button — visible only to NAMT and AFM. Trainee/Trainer/Certifier can fill
// per-member dates in normal view.

const { useState: useStateFT } = React;

function FormalSection({ title, sectionKey, items, progress, onCatalogChange, setProgress, role, canEdit, courseFilledByRole }) {
  const ro = role === "trainee";
  const update = (idx, patch) => {
    const next = [...items];
    next[idx] = { ...next[idx], ...patch };
    onCatalogChange(next);
  };
  const add = () => onCatalogChange([...items, { id: window.AMTR_Store.uid("ft"), course: "" }]);
  const del = (idx) => {
    if (!confirm(`Delete course "${items[idx].course}"? Per-member progress on this course will be hidden.`)) return;
    const next = [...items];
    next.splice(idx, 1);
    onCatalogChange(next);
  };

  // Drag-and-drop row reorder (catalog edit mode).
  const [dragIdx, setDragIdx] = useStateFT(null);
  const [dropIdx, setDropIdx] = useStateFT(null);
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
      const next = items.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      onCatalogChange(next);
    }
    setDragIdx(null); setDropIdx(null);
  };
  const onDragEndRow = () => { setDragIdx(null); setDropIdx(null); };

  return (
    <Card title={title} flush>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Course Title</th>
              <th style={{width: 170}}>Start Date</th>
              <th style={{width: 170}}>Complete Date</th>
              {canEdit && <th style={{width: 40}}></th>}
              {canEdit && <th style={{width: 40}}></th>}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={canEdit ? 5 : 3}>
                <Empty
                  title="No courses in this section"
                  hint={canEdit ? "Add the first course with the button below." : "An admin (NAMT/AFM) can add courses in catalog edit mode."}
                />
              </td></tr>
            )}
            {items.map((ft, idx) => {
              const p = progress[ft.id] || {};
              return (
                <tr key={ft.id}
                  className={[
                    dragIdx === idx ? "row-dragging" : "",
                    dropIdx === idx ? "row-drop-target" : "",
                    dropIdx === items.length && idx === items.length - 1 ? "row-drop-target-end" : "",
                  ].filter(Boolean).join(" ")}
                  onDragOver={canEdit ? onDragOverRow(idx) : undefined}
                  onDrop={canEdit ? onDropRow : undefined}
                  onDragEnd={canEdit ? onDragEndRow : undefined}
                >
                  <td>
                    {canEdit
                      ? <EditableInput value={ft.course} onChange={(v)=>update(idx,{course:v})} placeholder="Course title" />
                      : <span style={{padding: "0 4px"}}>{ft.course || <span className="muted">—</span>}</span>
                    }
                  </td>
                  <td>
                    <input type="date" className="cell-input mono" value={p.startDate||""} disabled={ro}
                      onChange={(e)=>setProgress(ft.id, { startDate: e.target.value })} />
                  </td>
                  <td>
                    <input type="date" className="cell-input mono" value={p.completeDate||""} disabled={ro}
                      onChange={(e)=>setProgress(ft.id, { completeDate: e.target.value })} />
                  </td>
                  {canEdit && (
                    <td className="drag-handle-cell"
                       draggable
                       onDragStart={onDragStart(idx)}
                       title="Drag to reorder"
                    >
                      <span className="drag-handle-grip" aria-label="Drag to reorder">⋮⋮</span>
                    </td>
                  )}
                  {canEdit && (
                    <td className="right">
                      <DeleteRowBtn onClick={()=>del(idx)} title="Delete course" />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {canEdit && <AddRowBtn onClick={add} label="Add course" />}
    </Card>
  );
}

function TabFormalTraining({ etr, update, role, formalCatalog, setFormalCatalog }) {
  const isAdmin = role === "namt" || role === "afm";
  const [editingCatalog, setEditingCatalog] = useStateFT(false);
  // Snapshot the catalog when entering edit mode so Cancel can roll back.
  const [editSnapshot, setEditSnapshot] = useStateFT(null);
  const canEdit = isAdmin && editingCatalog && !!setFormalCatalog;

  const progress = etr.formalTrainingProgress || {};
  const setSectionItems = (key, items) => {
    setFormalCatalog(s => ({ ...s, [key]: items }));
  };
  const setProgress = (courseId, patch) => {
    const merged = { ...(progress[courseId] || {}), ...patch };
    const cleaned = Object.fromEntries(Object.entries(merged).filter(([_, v]) => v !== "" && v != null));
    const next = { ...progress };
    if (Object.keys(cleaned).length === 0) {
      delete next[courseId];
    } else {
      next[courseId] = cleaned;
    }
    update({ ...etr, formalTrainingProgress: next });
  };

  return (
    <div>
      <PageHead
        crumb="Qualifications"
        title="Formal Training"
        formId="HAF · Initial · Continuation"
        action={isAdmin && setFormalCatalog ? (
          editingCatalog
            ? (
              <div style={{display:"flex", gap:8}}>
                <button className="btn" onClick={() => {
                  if (editSnapshot && JSON.stringify(editSnapshot) !== JSON.stringify(formalCatalog)) {
                    if (!confirm("Discard catalog changes since you entered edit mode?")) return;
                    setFormalCatalog(() => editSnapshot);
                  }
                  setEditSnapshot(null);
                  setEditingCatalog(false);
                }} title="Discard changes and exit edit mode">✕ Cancel</button>
                <button className="btn primary" onClick={() => { setEditSnapshot(null); setEditingCatalog(false); }} title="Keep changes and exit edit mode">✓ Save & Exit</button>
              </div>
            )
            : <button className="btn" onClick={() => { setEditSnapshot(JSON.parse(JSON.stringify(formalCatalog))); setEditingCatalog(true); }} title="Enter catalog edit mode — add/rename/delete courses and reorder">✎ Edit catalog</button>
        ) : null}
      />

      {editingCatalog && (
        <div className="jqs-edit-banner">
          <span className="dot"></span>
          <span><strong>Catalog edit mode.</strong> You can rename, add, delete, and reorder courses. These changes apply to <em>every</em> member's record. Click <em>Save & Exit</em> to keep changes, or <em>Cancel</em> to discard.</span>
        </div>
      )}

      <FormalSection
        title="HAF — Career Progression Courses"
        sectionKey="haf"
        items={formalCatalog.haf || []}
        progress={progress}
        onCatalogChange={(v)=>setSectionItems("haf", v)}
        setProgress={setProgress}
        role={role}
        canEdit={canEdit}
      />
      <FormalSection
        title="Initial Training (CBTs / required prerequisites)"
        sectionKey="initial"
        items={formalCatalog.initial || []}
        progress={progress}
        onCatalogChange={(v)=>setSectionItems("initial", v)}
        setProgress={setProgress}
        role={role}
        canEdit={canEdit}
      />
      <FormalSection
        title="Optional Continuation Training"
        sectionKey="continuation"
        items={formalCatalog.continuation || []}
        progress={progress}
        onCatalogChange={(v)=>setSectionItems("continuation", v)}
        setProgress={setProgress}
        role={role}
        canEdit={canEdit}
      />
    </div>
  );
}

window.TabFormalTraining = TabFormalTraining;
