/* global React */
// Shared UI primitives. Exposed as window.AMTR_UI.

const { useState, useEffect, useRef } = React;

// ----- editable cell helpers -----

function EditableInput({ value, onChange, readOnly, mono, placeholder, type = "text" }) {
  return (
    <input
      type={type}
      className={"cell-input" + (mono ? " mono" : "")}
      value={value || ""}
      placeholder={placeholder}
      readOnly={readOnly}
      disabled={readOnly}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function EditableTextarea({ value, onChange, readOnly, rows = 2, placeholder }) {
  return (
    <textarea
      className="cell-textarea"
      rows={rows}
      value={value || ""}
      readOnly={readOnly}
      disabled={readOnly}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function FormField({ label, children, fullWidth }) {
  return (
    <div className="field" style={fullWidth ? { gridColumn: "1 / -1" } : null}>
      <label>{label}</label>
      {children}
    </div>
  );
}

function TextField({ label, value, onChange, readOnly, fullWidth, placeholder, type = "text" }) {
  return (
    <FormField label={label} fullWidth={fullWidth}>
      <input
        type={type}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        disabled={readOnly}
        placeholder={placeholder}
      />
    </FormField>
  );
}

function SelectField({ label, value, onChange, readOnly, options, fullWidth, placeholder }) {
  return (
    <FormField label={label} fullWidth={fullWidth}>
      <select
        value={value || ""}
        disabled={readOnly}
        onChange={(e) => onChange(e.target.value)}
      >
        {placeholder !== false && <option value="">{placeholder || "—"}</option>}
        {options.map((o) => (
          <option key={o.value || o} value={o.value || o}>{o.label || o}</option>
        ))}
      </select>
    </FormField>
  );
}

// ----- buttons -----

function AddRowBtn({ onClick, label = "Add row", disabled }) {
  return (
    <div className="tbl-foot">
      <button className="btn" onClick={onClick} disabled={disabled}>
        <span>+</span> {label}
      </button>
    </div>
  );
}

function DeleteRowBtn({ onClick, disabled, title = "Delete row" }) {
  return (
    <button className="icon-x" onClick={onClick} disabled={disabled} title={title}>
      ×
    </button>
  );
}

// ----- status pill -----

function StatusPill({ status }) {
  const s = (status || "").toLowerCase();
  let cls = "muted";
  if (["complete", "current", "qualified", "verified", "yes", "active"].includes(s)) cls = "ok";
  else if (["upcoming", "in progress", "pending"].includes(s)) cls = "info";
  else if (["overdue", "missing", "no", "failed"].includes(s)) cls = "bad";
  else if (["warning", "due soon"].includes(s)) cls = "warn";
  return <span className={"pill " + cls}>{status || "—"}</span>;
}

// ----- card -----

function Card({ title, sub, action, children, flush }) {
  return (
    <div className="card">
      {(title || sub || action) && (
        <div className="card-head">
          <div>
            {title && <h2>{title}</h2>}
            {sub && <div className="sub">{sub}</div>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className={"card-body" + (flush ? " flush" : "")}>{children}</div>
    </div>
  );
}

// ----- page heading -----

function PageHead({ crumb, title, formId, action }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
      </div>
      <div style={{display:"flex", alignItems:"center", gap:12}}>
        {action}
      </div>
    </div>
  );
}

// ----- mode banner -----

function ModeBanner({ role }) {
  if (role === "trainer") {
    return (
      <div className="mode-banner trainer">
        <span className="dot"></span>
        <span><strong>Trainer / Certifier mode.</strong> You can edit all fields including sign-off columns.</span>
      </div>
    );
  }
  if (role === "namt") {
    return (
      <div className="mode-banner trainer">
        <span className="dot"></span>
        <span><strong>NAMT mode.</strong> You can edit all fields including the NAMT sign-off column.</span>
      </div>
    );
  }
  if (role === "certifier") {
    return (
      <div className="mode-banner trainer">
        <span className="dot"></span>
        <span><strong>Certifier mode.</strong> You can sign Certifier-initials columns on tasks that require certification.</span>
      </div>
    );
  }
  if (role === "afm") {
    return (
      <div className="mode-banner trainer">
        <span className="dot"></span>
        <span><strong>AFM mode.</strong> You can edit all fields including the AFM sign-off column.</span>
      </div>
    );
  }
  return (
    <div className="mode-banner">
      <span className="dot"></span>
      <span><strong>Trainee mode.</strong> You can log your own progress; sign-off columns are locked to your trainer.</span>
    </div>
  );
}

// ----- empty state -----

function Empty({ title, hint }) {
  return (
    <div className="empty">
      <div className="title">{title}</div>
      <div>{hint}</div>
    </div>
  );
}

// ----- expand toggle for nested rows -----

function ExpandBtn({ open, onClick }) {
  return (
    <button className="expand-btn" onClick={onClick} title={open ? "Collapse" : "Expand"}>
      {open ? "−" : "+"}
    </button>
  );
}

// ----- yes/no -----

function YesNoSelect({ value, onChange, readOnly }) {
  const cls = value === "Yes" ? "yes" : value === "No" ? "no" : "";
  return (
    <select
      className={"yn-select " + cls}
      value={value || ""}
      disabled={readOnly}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">—</option>
      <option value="Yes">Yes</option>
      <option value="No">No</option>
    </select>
  );
}

Object.assign(window, {
  EditableInput,
  EditableTextarea,
  FormField,
  TextField,
  SelectField,
  AddRowBtn,
  DeleteRowBtn,
  StatusPill,
  Card,
  PageHead,
  ModeBanner,
  Empty,
  ExpandBtn,
  YesNoSelect,
});
window.AMTR_UI = {
  EditableInput, EditableTextarea, FormField, TextField, SelectField,
  AddRowBtn, DeleteRowBtn, StatusPill, Card, PageHead, ModeBanner, Empty, ExpandBtn, YesNoSelect,
};
