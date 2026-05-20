/* global React */
// JQS-CFETP — full 1C7X1 Job Qualification Standard catalog.
// Stage A: read-only structural shell.
// Stage B: per-member progress columns + Certifier role.
// Stage C: NAMT/AFM catalog editing (title, core/cert, prof codes, add/delete tasks)
//          + "required at installation" yellow highlight + required-only filter.
// Stage C+: per-row Kind/Depth selector (section ↔ item, L1/L2/L3/L4)
//           + TR reference dropdown (curated from catalog refs).

const { useState: useStateJqs, useMemo: useMemoJqs } = React;

// ---------- helpers ----------

function jqsCatalogFallback() {
  return window.__JQS_CATALOG || { meta: {}, catalog: [] };
}

const KIND_DEPTH_OPTIONS = [
  { value: "section-1", label: "Section · L1" },
  { value: "section-2", label: "Section · L2" },
  { value: "section-3", label: "Section · L3" },
  { value: "item-2",    label: "Item · L2"    },
  { value: "item-3",    label: "Item · L3"    },
  { value: "item-4",    label: "Item · L4"    },
];

function rowKindDepthValue(row) {
  const depth = Math.max(1, Math.min(4, row.depth || 2));
  return `${row.kind}-${depth}`;
}

function applyKindDepth(row, value) {
  const [kind, depthStr] = value.split("-");
  const depth = parseInt(depthStr, 10);
  if (kind === "section" && row.kind !== "section") {
    // Promote item to section — keep title + number; drop data columns.
    return {
      kind: "section",
      number: row.number,
      depth,
      title: row.title || "",
      tr: row.tr || "",
      required: !!row.required,
    };
  }
  if (kind === "item" && row.kind !== "item") {
    // Demote section to item — keep title + number; drop TR; add empty data fields.
    return {
      kind: "item",
      number: row.number,
      depth,
      title: row.title || "",
      coreCert: "",
      deploySei: "",
      prof3: "",
      prof5: "",
      prof7: "",
      prof9: "",
      required: !!row.required,
    };
  }
  // Same kind — just change depth.
  return { ...row, depth };
}

function makeNewItem(afterRow) {
  const baseNum = afterRow ? afterRow.number : "";
  const segs = baseNum ? baseNum.split(".") : [""];
  const guess = segs.length > 1 ? segs.slice(0, -1).join(".") + "." + ((parseInt(segs[segs.length-1], 10) || 0) + 1) : "";
  return {
    kind: "item",
    number: guess,
    depth: afterRow ? afterRow.depth : 2,
    title: "",
    coreCert: "",
    deploySei: "",
    prof3: "",
    prof5: "",
    prof7: "",
    prof9: "",
    required: false,
  };
}

// Append a reference to a comma-separated TR string, dedup.
function appendRef(currentTr, ref) {
  const r = (ref || "").trim();
  if (!r) return currentTr || "";
  const existing = (currentTr || "").split(/,\s*/).map(s => s.trim()).filter(Boolean);
  if (existing.some(x => x.toLowerCase() === r.toLowerCase())) return currentTr || "";
  existing.push(r);
  return existing.join(", ");
}

// ---------- shared admin controls ----------

function KindDepthSelect({ row, onChange }) {
  return (
    <select
      className="jqs-kind-select"
      value={rowKindDepthValue(row)}
      onChange={(e) => onChange(applyKindDepth(row, e.target.value))}
      onClick={(e) => e.stopPropagation()}
      title="Change row kind (section / item) and indent depth"
    >
      {KIND_DEPTH_OPTIONS.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function RequiredStar({ row, onChange }) {
  return (
    <button
      type="button"
      className={"jqs-star" + (row.required ? " active" : "")}
      onClick={(e) => { e.stopPropagation(); onChange({ ...row, required: !row.required }); }}
      title={row.required ? "Required at this installation — click to unmark" : "Mark required at this installation (highlight yellow)"}
      aria-pressed={!!row.required}
    >★</button>
  );
}

function DeleteX({ onDelete, label = "Delete this row" }) {
  return (
    <button
      type="button"
      className="icon-x"
      onClick={(e) => { e.stopPropagation(); onDelete(); }}
      title={label}
    >×</button>
  );
}

// ---------- section row ----------

function JqsSectionRow({ row, expanded, onToggle, showTr, canEdit, onPatch, onReplace, onAddItem, onDelete, refOptions }) {
  const indent = Math.max(0, row.depth - 1) * 18;
  const hasTr = !!row.tr;
  const caretEnabled = canEdit || hasTr;
  const showPanel = expanded && showTr && (hasTr || canEdit);
  return (
    <>
      <tr className={"jqs-section-row jqs-depth-" + row.depth + (row.required ? " jqs-required" : "")}>
        <td colSpan={canEdit ? 13 : 12}>
          <div className="jqs-section-inner" style={{ paddingLeft: indent }}>
            <button
              type="button"
              className="jqs-section-toggle"
              onClick={onToggle}
              disabled={!caretEnabled}
              aria-expanded={expanded}
              title={caretEnabled ? (expanded ? "Hide references" : (hasTr ? "Show references" : "Add references")) : ""}
            >
              <span className="jqs-section-num">{row.number || ""}</span>
              {canEdit ? (
                <input
                  className="jqs-section-edit"
                  value={row.title || ""}
                  onChange={(e) => onPatch({ title: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Section title"
                />
              ) : (
                <span className="jqs-section-title">{row.title}</span>
              )}
              {caretEnabled && <span className="jqs-section-caret">{expanded ? "▾" : "▸"}</span>}
            </button>
            {canEdit && (
              <div className="jqs-section-controls" onClick={(e) => e.stopPropagation()}>
                <KindDepthSelect row={row} onChange={onReplace} />
                <RequiredStar row={row} onChange={onReplace} />
                <button
                  type="button"
                  className="jqs-add-task-btn"
                  onClick={(e) => { e.stopPropagation(); onAddItem(); }}
                  title="Add task at end of this section"
                >+ Add task</button>
                <DeleteX onDelete={onDelete} label="Delete this section" />
              </div>
            )}
          </div>
        </td>
      </tr>
      {showPanel && (
        <tr className="jqs-tr-row">
          <td colSpan={canEdit ? 13 : 12}>
            <div className="jqs-tr-inner" style={{ paddingLeft: indent + 18 }}>
              <span className="jqs-tr-label">TR</span>
              {canEdit ? (
                <div className="jqs-tr-edit-wrap">
                  <select
                    className="jqs-ref-picker"
                    value=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      onPatch({ tr: appendRef(row.tr || "", e.target.value) });
                      e.target.value = ""; // reset
                    }}
                    title="Pick a reference from the curated list"
                  >
                    <option value="">+ Add reference…</option>
                    {refOptions.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <textarea
                    className="jqs-tr-edit"
                    value={row.tr || ""}
                    onChange={(e) => onPatch({ tr: e.target.value })}
                    rows={2}
                    placeholder="Type references (comma-separated) or pick from the dropdown above"
                  />
                </div>
              ) : (
                <span className="jqs-tr-text">{row.tr}</span>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ---------- item row ----------

function JqsItemRow({ row, progress, onChange, perms, canEdit, onPatch, onReplace, onDelete }) {
  const indent = Math.max(0, row.depth - 1) * 18;
  const requiresCert = /\^/.test(row.coreCert || "");
  const set = (patch) => onChange({ ...progress, ...patch });
  return (
    <tr className={"jqs-item-row" + (row.required ? " jqs-required" : "")}>
      <td className="jqs-task-cell">
        <div style={{ paddingLeft: indent, display: "flex", alignItems: "center", gap: 6 }}>
          {canEdit ? (
            <input
              className="cell-input mono jqs-num-edit"
              value={row.number || ""}
              onChange={(e) => onPatch({ number: e.target.value })}
              placeholder="N.N"
            />
          ) : (
            <span className="jqs-item-num">{row.number}</span>
          )}
          {canEdit ? (
            <input
              className="cell-input jqs-title-edit"
              value={row.title || ""}
              onChange={(e) => onPatch({ title: e.target.value })}
              placeholder="Task title"
            />
          ) : (
            <span className="jqs-item-title">{row.title}</span>
          )}
        </div>
      </td>
      <td className="jqs-core mono">
        {canEdit
          ? <input className="cell-input mono jqs-tiny" value={row.coreCert || ""} onChange={(e) => onPatch({ coreCert: e.target.value })} maxLength={4} />
          : (row.coreCert || "")
        }
      </td>
      <td className="jqs-deploy mono">
        {canEdit
          ? <input className="cell-input mono jqs-tiny" value={row.deploySei || ""} onChange={(e) => onPatch({ deploySei: e.target.value })} maxLength={3} />
          : (row.deploySei || "")
        }
      </td>
      <td className="jqs-progress">
        <input
          type="date"
          className="cell-input mono"
          value={progress.start || ""}
          disabled={!perms.canStart}
          onChange={(e) => set({ start: e.target.value })}
        />
      </td>
      <td className="jqs-progress">
        <input
          type="date"
          className="cell-input mono"
          value={progress.complete || ""}
          disabled={!perms.canComplete}
          onChange={(e) => set({ complete: e.target.value })}
        />
      </td>
      <td className="jqs-progress">
        <input
          type="text"
          className="cell-input mono jqs-init"
          value={progress.traineeInit || ""}
          maxLength={3}
          disabled={!perms.canTraineeInit}
          placeholder="—"
          onChange={(e) => set({ traineeInit: e.target.value.toUpperCase() })}
        />
      </td>
      <td className="jqs-progress">
        <input
          type="text"
          className="cell-input mono jqs-init"
          value={progress.trainerInit || ""}
          maxLength={3}
          disabled={!perms.canTrainerInit}
          placeholder="—"
          onChange={(e) => set({ trainerInit: e.target.value.toUpperCase() })}
        />
      </td>
      <td className="jqs-progress">
        {requiresCert ? (
          <input
            type="text"
            className="cell-input mono jqs-init"
            value={progress.certifierInit || ""}
            maxLength={3}
            disabled={!perms.canCertifierInit}
            placeholder="—"
            onChange={(e) => set({ certifierInit: e.target.value.toUpperCase() })}
          />
        ) : (
          <span className="jqs-na" title="This task does not require certifier sign-off">N/A</span>
        )}
      </td>
      <td className="jqs-prof mono">
        {canEdit
          ? <input className="cell-input mono jqs-tiny" value={row.prof3 || ""} onChange={(e) => onPatch({ prof3: e.target.value })} maxLength={4} />
          : (row.prof3 || "")}
      </td>
      <td className="jqs-prof mono">
        {canEdit
          ? <input className="cell-input mono jqs-tiny" value={row.prof5 || ""} onChange={(e) => onPatch({ prof5: e.target.value })} maxLength={4} />
          : (row.prof5 || "")}
      </td>
      <td className="jqs-prof mono">
        {canEdit
          ? <input className="cell-input mono jqs-tiny" value={row.prof7 || ""} onChange={(e) => onPatch({ prof7: e.target.value })} maxLength={4} />
          : (row.prof7 || "")}
      </td>
      <td className="jqs-prof mono">
        {canEdit
          ? <input className="cell-input mono jqs-tiny" value={row.prof9 || ""} onChange={(e) => onPatch({ prof9: e.target.value })} maxLength={4} />
          : (row.prof9 || "")}
      </td>
      {canEdit && (
        <td className="jqs-admin jqs-admin-actions">
          <div className="jqs-admin-stack">
            <KindDepthSelect row={row} onChange={onReplace} />
            <RequiredStar row={row} onChange={onReplace} />
            <DeleteX onDelete={onDelete} label="Delete this task" />
          </div>
        </td>
      )}
    </tr>
  );
}

// ---------- main tab ----------

function TabJqs({ etr, update, role, catalog: catalogProp, catalogMeta, setCatalog }) {
  const fallback = jqsCatalogFallback();
  const catalog = catalogProp && catalogProp.length ? catalogProp : fallback.catalog;
  const meta = catalogMeta || fallback.meta;

  const [expanded, setExpanded] = useStateJqs(() => ({}));
  const [showTr, setShowTr] = useStateJqs(true);
  const [requiredOnly, setRequiredOnly] = useStateJqs(false);
  const [editingCatalog, setEditingCatalog] = useStateJqs(false);
  // Snapshot the catalog when entering edit mode so Cancel can roll back.
  const [editSnapshot, setEditSnapshot] = useStateJqs(null);

  const progress = etr.jqsProgress || {};
  const isAdmin = role === "namt" || role === "afm";
  const canEdit = isAdmin && !!setCatalog && editingCatalog;
  const perms = {
    canStart:         isAdmin || role === "trainee",
    canComplete:      isAdmin || role === "trainer",
    canTraineeInit:   isAdmin || role === "trainee",
    canTrainerInit:   isAdmin || role === "trainer",
    canCertifierInit: isAdmin || role === "certifier",
  };

  // Curated reference list: every unique ref currently appearing in any section TR
  const refOptions = useMemoJqs(() => {
    const set = new Set();
    catalog.forEach(r => {
      if (r.kind === "section" && r.tr) {
        r.tr.split(/,\s*/).forEach(s => {
          const cleaned = s.trim();
          if (cleaned) set.add(cleaned);
        });
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [catalog]);

  // catalog mutations
  const patchRow = (idx, patch) => {
    if (!setCatalog) return;
    const next = catalog.slice();
    next[idx] = { ...next[idx], ...patch };
    setCatalog(next);
  };
  const replaceRow = (idx, newRow) => {
    if (!setCatalog) return;
    const next = catalog.slice();
    next[idx] = newRow;
    setCatalog(next);
  };
  const deleteRow = (idx) => {
    if (!setCatalog) return;
    const r = catalog[idx];
    const label = r.kind === "section" ? `section "${r.number} ${r.title}"` : `task "${r.number} ${r.title}"`;
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
    const next = catalog.slice();
    next.splice(idx, 1);
    setCatalog(next);
  };
  const addItemAfterSection = (sectionIdx) => {
    if (!setCatalog) return;
    let insertAt = sectionIdx + 1;
    while (insertAt < catalog.length && catalog[insertAt].kind !== "section") insertAt++;
    const base = catalog[insertAt - 1] || catalog[sectionIdx];
    const next = catalog.slice();
    next.splice(insertAt, 0, makeNewItem(base));
    setCatalog(next);
  };

  // per-member progress
  const setRowProgress = (number, val) => {
    const next = { ...progress };
    const cleaned = { ...val };
    Object.keys(cleaned).forEach(k => { if (!cleaned[k]) delete cleaned[k]; });
    if (Object.keys(cleaned).length === 0) {
      delete next[number];
    } else {
      next[number] = cleaned;
    }
    update({ ...etr, jqsProgress: next });
  };

  // expand/collapse refs
  const toggleAll = (state) => {
    const next = {};
    catalog.forEach((r, i) => { if (r.kind === "section") next[i] = state; });
    setExpanded(next);
  };
  const toggleOne = (idx) => setExpanded(s => ({ ...s, [idx]: !s[idx] }));

  // computed counts
  const itemCount = catalog.filter(c => c.kind === "item").length;
  const sectionCount = catalog.filter(c => c.kind === "section").length;
  const requiredCount = catalog.filter(c => c.kind === "item" && c.required).length;
  const completeCount = Object.values(progress).filter(p => p && p.complete).length;

  // filter: "Required only"
  const visibleIndexes = (() => {
    if (!requiredOnly) return null;
    const set = new Set();
    let currentSectionIdx = -1;
    for (let i = 0; i < catalog.length; i++) {
      const r = catalog[i];
      if (r.kind === "section") {
        currentSectionIdx = i;
      } else if (r.required) {
        set.add(i);
        if (currentSectionIdx >= 0) {
          let probeDepth = catalog[currentSectionIdx].depth;
          set.add(currentSectionIdx);
          for (let j = currentSectionIdx - 1; j >= 0 && probeDepth > 1; j--) {
            if (catalog[j].kind === "section" && catalog[j].depth < probeDepth) {
              set.add(j);
              probeDepth = catalog[j].depth;
            }
          }
        }
      }
    }
    return set;
  })();

  return (
    <div>
      <PageHead
        crumb="Qualifications"
        title="JQS-CFETP — 1C7X1 Job Qualification Standard"
        formId={meta.afsc ? `${meta.afsc} · REV ${meta.revision}` : "JQS-CFETP"}
        action={isAdmin && setCatalog ? (
          editingCatalog ? (
            <div style={{display:"flex", gap:8}}>
              <button className="btn" onClick={() => {
                if (editSnapshot && JSON.stringify(editSnapshot) !== JSON.stringify(catalog)) {
                  if (!confirm("Discard catalog changes since you entered edit mode?")) return;
                  setCatalog(editSnapshot);
                }
                setEditSnapshot(null);
                setEditingCatalog(false);
              }} title="Discard changes and exit edit mode">✕ Cancel</button>
              <button className="btn primary" onClick={() => { setEditSnapshot(null); setEditingCatalog(false); }} title="Keep changes and exit edit mode">✓ Save & Exit</button>
            </div>
          ) : (
            <button className="btn" onClick={() => { setEditSnapshot(JSON.parse(JSON.stringify(catalog))); setEditingCatalog(true); }} title="Enter catalog edit mode — add/remove tasks, change indentation, edit references">✎ Edit catalog</button>
          )
        ) : null}
      />

      {editingCatalog && (
        <div className="jqs-edit-banner">
          <span className="dot"></span>
          <span><strong>Catalog edit mode.</strong> You can change row kind/indent, edit titles, manage references, add/delete tasks, and mark required-at-installation. Click <em>Save & Exit</em> to keep changes, or <em>Cancel</em> to discard.</span>
        </div>
      )}

      <div className="ref-block" style={{margin: "0 0 16px"}}>
        <div>{meta.note1}</div>
        <div style={{marginTop: 6, color: "var(--ink-2)"}}>{meta.note2}</div>
      </div>

      <Card flush
        title={`${meta.afsc || "JQS"} Catalog — ${sectionCount} sections · ${itemCount} tasks${requiredCount ? ` · ${requiredCount} required at installation` : ""}`}
        sub={`Revision: ${meta.revision || ""} · ${completeCount} of ${itemCount} tasks have a Training Complete date`}
        action={
          <div style={{display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap"}}>
            <label className="jqs-tr-toggle">
              <input
                type="checkbox"
                checked={requiredOnly}
                onChange={(e) => setRequiredOnly(e.target.checked)}
              />
              <span>Required only</span>
            </label>
            <button className="btn small" onClick={() => toggleAll(true)}>Expand all refs</button>
            <button className="btn small" onClick={() => toggleAll(false)}>Collapse all</button>
            <label className="jqs-tr-toggle">
              <input
                type="checkbox"
                checked={showTr}
                onChange={(e) => setShowTr(e.target.checked)}
              />
              <span>Show TR references</span>
            </label>
          </div>
        }
      >
        <div className="jqs-table-wrap">
          <table className={"jqs-table" + (canEdit ? " jqs-edit-mode" : "")}>
            <colgroup>
              <col className="col-task" />
              <col className="col-core" />
              <col className="col-deploy" />
              <col className="col-prog" />
              <col className="col-prog" />
              <col className="col-init" />
              <col className="col-init" />
              <col className="col-init" />
              <col className="col-prof" />
              <col className="col-prof" />
              <col className="col-prof" />
              <col className="col-prof" />
              {canEdit && <col className="col-admin-actions" />}
            </colgroup>
            <thead>
              <tr className="jqs-group-head">
                <th className="grp-task">1. Tasks, Knowledge and Technical References</th>
                <th className="grp-core" colSpan={2}>2. Core Tasks</th>
                <th className="grp-ojt" colSpan={5}>3. OJT Task Certification Documentation</th>
                <th className="grp-prof" colSpan={4}>4. Proficiency Codes Used To Indicate Training/Information Provided via DL or Course</th>
                {canEdit && <th className="grp-admin">Admin</th>}
              </tr>
              <tr className="jqs-sub-head">
                <th></th>
                <th>Core / Cert ^</th>
                <th>Deployment * / SEI +</th>
                <th>Training Start</th>
                <th>Training Complete</th>
                <th>Trainee Initials</th>
                <th>Trainer Initials</th>
                <th>Certifier Initials</th>
                <th>3 Lvl</th>
                <th>5 Lvl</th>
                <th>7 Lvl</th>
                <th>9 Lvl</th>
                {canEdit && <th>Kind · ★ · ×</th>}
              </tr>
            </thead>
            <tbody>
              {catalog.map((row, i) => {
                if (visibleIndexes && !visibleIndexes.has(i)) return null;
                if (row.kind === "section") {
                  return (
                    <JqsSectionRow
                      key={i}
                      row={row}
                      expanded={!!expanded[i]}
                      onToggle={() => toggleOne(i)}
                      showTr={showTr}
                      canEdit={canEdit}
                      onPatch={(patch) => patchRow(i, patch)}
                      onReplace={(next) => replaceRow(i, next)}
                      onAddItem={() => addItemAfterSection(i)}
                      onDelete={() => deleteRow(i)}
                      refOptions={refOptions}
                    />
                  );
                }
                return (
                  <JqsItemRow
                    key={i}
                    row={row}
                    progress={progress[row.number] || {}}
                    onChange={(val) => setRowProgress(row.number, val)}
                    perms={perms}
                    canEdit={canEdit}
                    onPatch={(patch) => patchRow(i, patch)}
                    onReplace={(next) => replaceRow(i, next)}
                    onDelete={() => deleteRow(i)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

window.TabJqs = TabJqs;
