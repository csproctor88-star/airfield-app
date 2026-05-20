/* global React */
// QTP / PCG Milestones — 4 sub-sections, each a phased plan (1-30 days, 30-60, etc.)
// Each phase is a list of milestone items the trainee should hit by that bucket.

const MS_SECTIONS = [
  { key: "fiveLevelQtp",   label: "5-Level QTP" },
  { key: "amosAmslPcg",    label: "AMOS / AMSL PCG" },
  { key: "sevenLevelQtp",  label: "7-Level QTP" },
  { key: "afmPcg",         label: "AFM PCG" },
];

const MS_WINDOWS = ["1-30 Days", "30-60 Days", "60-90 Days", "90-120 Days", "120-180 Days"];

function MilestoneItemRow({ item, update, remove, role, showSts }) {
  const ro = role === "trainee";
  const set = (patch) => update({ ...item, ...patch });
  return (
    <div className={"milestone-strip" + (showSts ? "" : " no-sts")}>
      {showSts && (
        <div className="when">
          <EditableInput mono value={item.stsItems} onChange={(v)=>set({stsItems:v})} readOnly={ro} placeholder="STS items" />
        </div>
      )}
      <div className="topic">
        <EditableInput value={item.topic} onChange={(v)=>set({topic:v})} readOnly={ro} placeholder="Topic / lesson title" />
      </div>
      <div className="signoff">
        <select
          className="cell-input window-select"
          value={item.window || ""}
          disabled={ro}
          onChange={(ev)=>set({window: ev.target.value})}
        >
          <option value="">—</option>
          {MS_WINDOWS.map(w => <option key={w} value={w}>{w}</option>)}
        </select>
        <DeleteRowBtn onClick={remove} disabled={ro} />
      </div>
    </div>
  );
}

function PhaseBlock({ phase, update, remove, role, showSts }) {
  const ro = role === "trainee";
  const items = phase.items || [];
  const addItem = () => update({ ...phase, items: [...items, { id: window.AMTR_Store.uid("mi"), stsItems: "", topic: "", window: "" }] });
  const updateItem = (idx, val) => { const next = [...items]; next[idx] = val; update({ ...phase, items: next }); };
  const delItem = (idx) => { const next = [...items]; next.splice(idx,1); update({ ...phase, items: next }); };

  return (
    <Card flush>
      <div className="card-head">
        <div>
          <h2>
            <input className="cell-input" style={{fontSize: 14, fontWeight: 600, width: "auto", minWidth: 180}}
              value={phase.label} disabled={ro} onChange={(ev)=>update({...phase, label: ev.target.value})} />
          </h2>
          <div className="sub" style={{marginTop: 4}}>
            <span className="chip">{`${items.length} milestone${items.length === 1 ? "" : "s"}`}</span>
          </div>
        </div>
        <div style={{display:"flex", gap: 8, alignItems:"center"}}>
          <DeleteRowBtn onClick={remove} disabled={ro} title="Delete phase" />
        </div>
      </div>
      {items.length === 0 ? (
        <Empty title="No milestones in this phase" hint="Add JQS / STS items the trainee should hit in this window." />
      ) : (
        items.map((it, i) => (
          <MilestoneItemRow
            key={it.id}
            item={it}
            update={(v) => updateItem(i, v)}
            remove={() => delItem(i)}
            role={role}
            showSts={showSts}
          />
        ))
      )}
      <div className="tbl-foot">
        <button className="btn small" onClick={addItem} disabled={ro}>+ Add milestone item</button>
      </div>
    </Card>
  );
}

function MilestoneSection({ section, data, onChange, role, showSts }) {
  const ro = role === "trainee";
  const phases = data.phases || [];

  const updatePhase = (idx, val) => { const next = [...phases]; next[idx] = val; onChange({ ...data, phases: next }); };
  const delPhase = (idx) => { const next = [...phases]; next.splice(idx,1); onChange({ ...data, phases: next }); };
  const addPhase = () => onChange({ ...data, phases: [...phases, { id: window.AMTR_Store.uid("ph"), label: "New phase", items: [] }] });

  return (
    <div>
      <div className="ref-block" style={{margin: 0, borderRadius: 0, borderLeft: 0, borderBottom: "1px solid var(--line-soft)"}}>
        <strong>{data.title}.</strong> {data.blurb}
      </div>
      <div style={{padding: 16, background: "var(--bg)"}}>
        {phases.map((p, i) => (
          <PhaseBlock
            key={p.id}
            phase={p}
            update={(v) => updatePhase(i, v)}
            remove={() => delPhase(i)}
            role={role}
            showSts={showSts}
          />
        ))}
      </div>
    </div>
  );
}

function TabMilestones({ etr, update, role }) {
  const { useState } = React;
  const [active, setActive] = useState("fiveLevelQtp");
  const ms = etr.milestones;
  const setSection = (key, val) => update({ ...etr, milestones: { ...ms, [key]: val } });
  const sec = MS_SECTIONS.find(s => s.key === active);

  return (
    <div>
      <PageHead crumb="Training Plan" title="QTP / PCG Milestones" formId="UPGRADE TRAINING TIMELINE" />
      <Card flush>
        <div className="subnav">
          {MS_SECTIONS.map((s) => (
            <button key={s.key} className={active===s.key?"active":""} onClick={()=>setActive(s.key)}>
              {s.label}
            </button>
          ))}
        </div>
        <MilestoneSection
          section={sec}
          data={ms[active]}
          onChange={(v)=>setSection(active, v)}
          role={role}
          showSts={active !== "amosAmslPcg" && active !== "afmPcg"}
        />
      </Card>
    </div>
  );
}

window.TabMilestones = TabMilestones;
