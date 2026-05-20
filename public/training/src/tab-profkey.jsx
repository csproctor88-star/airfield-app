/* global React */
// Proficiency Code Key — read-only reference

function TabProficiencyKey() {
  const k = window.AMTR_Store.PROFICIENCY_KEY;

  return (
    <div>
      <PageHead crumb="Training References" title="Proficiency Code Key" formId="CFETP PROFICIENCY SCALES" />

      <Card title="Task Performance Levels" sub="What the trainee can do unaided">
        <div className="key-grid">
          {k.performance.map(p => (
            <div className="key-card" key={p.code}>
              <div className="code">{p.code} — {p.label}</div>
              <div className="def">{p.desc}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Task Knowledge Levels" sub="What the trainee knows about the task (often paired with a performance code, e.g. '3c')">
        <div className="key-grid">
          {k.knowledge.map(p => (
            <div className="key-card" key={p.code}>
              <div className="code">{p.code} — {p.label}</div>
              <div className="def">{p.desc}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Subject Knowledge Levels" sub="What the trainee knows about a subject area, broader than a single task">
        <div className="key-grid">
          {k.subject.map(p => (
            <div className="key-card" key={p.code}>
              <div className="code">{p.code} — {p.label}</div>
              <div className="def">{p.desc}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Marks">
        <div className="key-grid">
          {k.marks.map(p => (
            <div className="key-card" key={p.code}>
              <div className="code">{p.code}</div>
              <div className="def">{p.desc}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Notes">
        <ul style={{margin:0, paddingLeft: 20, color: "var(--ink-2)", lineHeight: 1.6}}>
          {k.notes.map((n,i) => <li key={i}>{n}</li>)}
        </ul>
      </Card>
    </div>
  );
}

window.TabProficiencyKey = TabProficiencyKey;
