/* global React */
// Training Status Codes — read-only reference (DAFI 36-2670)

function TabTrainingStatusCodes() {
  const tsc = window.AMTR_Store.TSC_TABLE;

  return (
    <div>
      <PageHead crumb="Training References" title="Training Status Codes" formId="DAFI 36-2670 — TSC REFERENCE" />

      <Card flush>
        <div className="key-grid">
          {tsc.map((t) => (
            <div className="key-card" key={t.code}>
              <div className="code">TSC {t.code}</div>
              <div className="def">{t.desc}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

window.TabTrainingStatusCodes = TabTrainingStatusCodes;
