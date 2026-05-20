/* global React */
// Files — supporting documents

function TabFiles({ etr, update, role }) {
  const ro = role === "trainee";
  const canReorder = role === "namt" || role === "afm";
  const items = etr.files || [];

  const updateRow = (idx, patch) => { const next = [...items]; next[idx] = { ...next[idx], ...patch }; update({ ...etr, files: next }); };
  const del = (idx) => { const next = [...items]; next.splice(idx,1); update({ ...etr, files: next }); };
  const moveRow = (idx, dir) => {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[idx], next[target]] = [next[target], next[idx]];
    update({ ...etr, files: next });
  };
  const add = (name = "") => update({ ...etr, files: [...items, { id: window.AMTR_Store.uid("f"), name, uploaded: new Date().toISOString().slice(0,10), size: "", status: "Verified", path: "" }] });

  const onDrop = (e) => {
    e.preventDefault();
    if (ro) return;
    const files = [...(e.dataTransfer?.files || [])];
    for (const f of files) {
      update({ ...etr, files: [...(etr.files||[]), { id: window.AMTR_Store.uid("f"), name: f.name, uploaded: new Date().toISOString().slice(0,10), size: humanSize(f.size), status: "Verified", path: "" }] });
    }
  };

  return (
    <div>
      <PageHead crumb="Supporting" title="Files" formId="ATTACHED RECORDS & EVIDENCE" />

      <div className="dropzone"
        onDragOver={(e)=>e.preventDefault()}
        onDrop={onDrop}>
        <strong>Drag files here</strong> or click below to attach a record (PDF, image, screenshots, MFRs).
        <div style={{marginTop: 10}}>
          <button className="btn" onClick={()=>add("")} disabled={ro}>+ Add file entry</button>
        </div>
      </div>

      <Card flush title={`Attached records (${items.length})`} sub="Inspections, MFRs, exported records, training certificates">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>File Name</th>
                <th style={{width: 130}}>Uploaded</th>
                <th style={{width: 100}}>Size</th>
                <th style={{width: 110}}>Status</th>
                {canReorder && <th style={{width: 40}}></th>}
                <th style={{width: 40}}></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={canReorder ? 6 : 5}><Empty title="No files attached" hint="Drop files in the box above or add an entry manually." /></td></tr>
              )}
              {items.map((it, idx) => (
                <tr key={it.id}>
                  <td><EditableInput value={it.name} onChange={(v)=>updateRow(idx,{name:v})} readOnly={ro} placeholder="filename.pdf" /></td>
                  <td><input type="date" className="cell-input mono" value={it.uploaded||""} disabled={ro} onChange={(ev)=>updateRow(idx,{uploaded: ev.target.value})} /></td>
                  <td><EditableInput mono value={it.size} onChange={(v)=>updateRow(idx,{size:v})} readOnly={ro} placeholder="—" /></td>
                  <td>
                    <select className={"yn-select " + (it.status==="Verified"?"yes":it.status==="Missing"?"no":"")}
                      value={it.status||""} disabled={ro}
                      onChange={(ev)=>updateRow(idx,{status: ev.target.value})}>
                      <option>Verified</option>
                      <option>Pending</option>
                      <option>Missing</option>
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
                          disabled={idx === items.length - 1}
                          title="Move down"
                          aria-label="Move row down"
                        >▼</button>
                      </div>
                    </td>
                  )}
                  <td className="right"><DeleteRowBtn onClick={()=>del(idx)} disabled={ro} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function humanSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + " KB";
  return (bytes/1024/1024).toFixed(1) + " MB";
}

window.TabFiles = TabFiles;
