/* global React */
// Cover tab — Member Information + Supervisor / Training Manager
// Read-only in trainee mode (cover edits are usually a Training Manager task)

function TabCover({ etr, update, role }) {
  const cover = etr.cover;
  const ro = role === "trainee";
  const canManageStatus = role === "namt" || role === "afm"; // Member Status, TSC, and supervisor info
  const statusRo = !canManageStatus;
  const set = (k, v) => update({ ...etr, cover: { ...etr.cover, [k]: v } });

  return (
    <div>
      <PageHead crumb="Member" title="Cover" formId="DAFI 36-2670 ATCH 14 / RECORD COVER" />

      <Card title="Member Information" sub="Identifying information for this airman's training record">
        <div className="field-grid">
          <TextField label="Full Name (Last, First M.)" value={cover.fullName} onChange={(v)=>set("fullName",v)} readOnly={ro} placeholder="Last, First M." />
          <TextField label="Grade / Rank" value={cover.grade} onChange={(v)=>set("grade",v)} readOnly={ro} placeholder="e.g. SrA / E-4" />
          <TextField label="DAFSC (Primary)" value={cover.dafsc} onChange={(v)=>set("dafsc",v)} readOnly={ro} placeholder="e.g. 1C771" />
          <TextField label="Unit" value={cover.unit} onChange={(v)=>set("unit",v)} readOnly={ro} placeholder="e.g. 127 OSS / AM Ops" />
          <TextField label="Installation" value={cover.installation} onChange={(v)=>set("installation",v)} readOnly={ro} placeholder="e.g. Selfridge ANGB" />
          <TextField label="Date Assigned" value={cover.dateAssigned} onChange={(v)=>set("dateAssigned",v)} readOnly={ro} type="date" />
          <SelectField label="Member Status" value={cover.status} onChange={(v)=>set("status",v)} readOnly={statusRo}
            options={["Active","Reserve","Guard","Civilian","Contractor","Separated"]} />
          <SelectField label="Training Status Code" value={cover.tsc} onChange={(v)=>set("tsc",v)} readOnly={statusRo}
            options={["A","B","C","D","E","F","G","I","K","M","P","Q","R","S","T","Y"]} placeholder="Select TSC" />
          <TextField label="Current Duty Position" value={cover.dutyPosition} onChange={(v)=>set("dutyPosition",v)} readOnly={statusRo} placeholder="e.g. Airfield Manager Shift Lead" />
        </div>
      </Card>

      <Card title="Supervisor / Training Manager" sub="Chain of training oversight">
        <div className="field-grid">
          <TextField label="Immediate Supervisor" value={cover.supervisor} onChange={(v)=>set("supervisor",v)} readOnly={statusRo} placeholder="Last, First (Rank)" />
          <TextField label="Unit Training Manager" value={cover.utm} onChange={(v)=>set("utm",v)} readOnly={statusRo} placeholder="Last, First (Rank)" />
          <TextField label="Commander" value={cover.commander} onChange={(v)=>set("commander",v)} readOnly={statusRo} placeholder="Last, First (Rank)" />
        </div>
      </Card>
    </div>
  );
}

window.TabCover = TabCover;
