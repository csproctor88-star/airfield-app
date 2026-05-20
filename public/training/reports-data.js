/* global window */
// Synthetic unit-level data for Reports tab exploration.
// 10 members, realistic AF distribution: trainees, certified, mix of skill levels.

const TODAY = new Date('2026-05-18');

function daysFromToday(d) {
  return Math.round((new Date(d) - TODAY) / 86400000);
}

const UNIT_MEMBERS = [
  // name, grade, skill, status, jqsReq, jqsDone, qtps, seis
  { id: 'm01', name: 'AGUILAR, M.',     grade: 'SSgt',  skill: '5', status: 'Certifier',
    jqsReq: 142, jqsDone: 142, qtp: ['5L'],          sei: ['368'],
    formal: { haf: 4, initial: 6, cont: 12, totalHaf: 4, totalInit: 7, totalCont: 14 },
    trainer: true, certifier: true,
    over: [], dueSoon: [], lastUpdate: '2026-05-12',
  },
  { id: 'm02', name: 'BRENNAN, T.',     grade: 'A1C',   skill: '3', status: 'Trainee',
    jqsReq: 142, jqsDone: 38, qtp: [],               sei: [],
    formal: { haf: 4, initial: 2, cont: 0, totalHaf: 4, totalInit: 7, totalCont: 0 },
    trainer: false, certifier: false,
    over: [
      { task: 'Self-Aid Buddy Care', due: '2026-04-08', tab: 'rat' },
    ],
    dueSoon: [
      { task: 'AF FORM 55 Brief', due: '2026-05-30', tab: 'daf1098' },
    ],
    lastUpdate: '2026-05-16',
  },
  { id: 'm03', name: 'CALDERON, J.',    grade: 'SrA',   skill: '5', status: 'Trainer',
    jqsReq: 142, jqsDone: 128, qtp: ['5L', 'AMSL'],  sei: [],
    formal: { haf: 4, initial: 7, cont: 11, totalHaf: 4, totalInit: 7, totalCont: 14 },
    trainer: true, certifier: false,
    over: [],
    dueSoon: [
      { task: 'CBRN Defense Survival Skills', due: '2026-06-04', tab: 'rat' },
      { task: 'Bird/Wildlife Aircraft Strike Hazard', due: '2026-06-12', tab: 'daf1098' },
    ],
    lastUpdate: '2026-05-15',
  },
  { id: 'm04', name: 'DAVIDSON, K.',    grade: 'TSgt',  skill: '7', status: 'Certifier',
    jqsReq: 142, jqsDone: 140, qtp: ['7L', 'AMSL'],  sei: ['155', '368'],
    formal: { haf: 4, initial: 7, cont: 13, totalHaf: 4, totalInit: 7, totalCont: 14 },
    trainer: true, certifier: true,
    over: [], dueSoon: [], lastUpdate: '2026-05-10',
  },
  { id: 'm05', name: 'ESPINOZA, R.',    grade: 'SSgt',  skill: '5', status: 'Trainer',
    jqsReq: 142, jqsDone: 119, qtp: ['5L'],          sei: ['368'],
    formal: { haf: 4, initial: 7, cont: 9, totalHaf: 4, totalInit: 7, totalCont: 14 },
    trainer: true, certifier: false,
    over: [
      { task: 'Aircraft Mishap Response', due: '2026-03-22', tab: 'daf1098' },
    ],
    dueSoon: [
      { task: 'Confined Space Entry Brief', due: '2026-05-29', tab: 'daf1098' },
    ],
    lastUpdate: '2026-05-14',
  },
  { id: 'm06', name: 'FOSTER, A.',      grade: 'A1C',   skill: '3', status: 'Trainee',
    jqsReq: 142, jqsDone: 22, qtp: [],               sei: [],
    formal: { haf: 4, initial: 1, cont: 0, totalHaf: 4, totalInit: 7, totalCont: 0 },
    trainer: false, certifier: false,
    over: [
      { task: 'JQS §4.2 Movement Area Control', due: '2026-05-01', tab: 'jqs' },
      { task: 'Initial 5-Level QTP Phase 1', due: '2026-04-30', tab: 'milestones' },
    ],
    dueSoon: [
      { task: 'AF FORM 55 Brief', due: '2026-06-08', tab: 'daf1098' },
    ],
    lastUpdate: '2026-05-16',
  },
  { id: 'm07', name: 'GREW, D.',        grade: 'SrA',   skill: '5', status: 'Trainee',
    jqsReq: 142, jqsDone: 64, qtp: ['5L'],           sei: [],
    formal: { haf: 4, initial: 5, cont: 4, totalHaf: 4, totalInit: 7, totalCont: 14 },
    trainer: false, certifier: false,
    over: [],
    dueSoon: [
      { task: 'Self-Aid Buddy Care', due: '2026-06-02', tab: 'rat' },
    ],
    lastUpdate: '2026-05-18',
  },
  { id: 'm08', name: 'HAYES, B.',       grade: 'MSgt',  skill: '7', status: 'AFM',
    jqsReq: 142, jqsDone: 142, qtp: ['7L', 'AFM'],   sei: ['155', '090', '3LZ'],
    formal: { haf: 4, initial: 7, cont: 14, totalHaf: 4, totalInit: 7, totalCont: 14 },
    trainer: true, certifier: true,
    over: [], dueSoon: [], lastUpdate: '2026-05-08',
  },
  { id: 'm09', name: 'IVERSON, L.',     grade: 'SrA',   skill: '5', status: 'Trainee',
    jqsReq: 142, jqsDone: 89, qtp: ['5L'],           sei: [],
    formal: { haf: 4, initial: 6, cont: 6, totalHaf: 4, totalInit: 7, totalCont: 14 },
    trainer: false, certifier: false,
    over: [
      { task: 'BASH Quarterly Walk', due: '2026-04-15', tab: 'daf1098' },
    ],
    dueSoon: [],
    lastUpdate: '2026-05-11',
  },
  { id: 'm10', name: 'JIMÉNEZ, P.',     grade: 'SSgt',  skill: '5', status: 'Trainer',
    jqsReq: 142, jqsDone: 134, qtp: ['5L', 'AMSL'],  sei: ['368'],
    formal: { haf: 4, initial: 7, cont: 10, totalHaf: 4, totalInit: 7, totalCont: 14 },
    trainer: true, certifier: false,
    over: [], dueSoon: [
      { task: 'CBRN Defense Survival Skills', due: '2026-06-15', tab: 'rat' },
    ],
    lastUpdate: '2026-05-13',
  },
];

// Recurring tasks for unit-wide 1098 / RAT compliance summary
const REC_TASKS_1098 = [
  { id: 't1', name: 'AF FORM 55 Brief',                  freq: 'Annual', req: 10, comp: 7, due: 2, over: 1 },
  { id: 't2', name: 'Bird/Wildlife Aircraft Strike Hzd', freq: 'Annual', req: 10, comp: 6, due: 3, over: 1 },
  { id: 't3', name: 'BASH Quarterly Walk',               freq: 'Quart.', req: 10, comp: 7, due: 1, over: 2 },
  { id: 't4', name: 'Confined Space Entry Brief',        freq: 'Annual', req: 10, comp: 8, due: 1, over: 1 },
  { id: 't5', name: 'Aircraft Mishap Response',          freq: 'Annual', req: 10, comp: 8, due: 1, over: 1 },
  { id: 't6', name: 'Airfield Driving Recurrency',       freq: 'Annual', req: 10, comp: 10,due: 0, over: 0 },
];

const REC_TASKS_RAT = [
  { id: 'r1', name: 'Self-Aid Buddy Care',               freq: 'Annual', req: 10, comp: 7, due: 2, over: 1 },
  { id: 'r2', name: 'CBRN Defense Survival Skills',      freq: '3 yr',   req: 10, comp: 6, due: 2, over: 2 },
  { id: 'r3', name: 'Cyber Awareness',                   freq: 'Annual', req: 10, comp: 9, due: 1, over: 0 },
  { id: 'r4', name: 'Information Assurance',             freq: 'Annual', req: 10, comp: 9, due: 1, over: 0 },
  { id: 'r5', name: 'Suicide / SAPR / Resiliency',       freq: 'Annual', req: 10, comp: 8, due: 2, over: 0 },
];

// Recent DAF 797 activity (cross-member task log)
const RECENT_797 = [
  { date: '2026-05-16', member: 'FOSTER, A.',    task: 'NOTAM origination — Class I',    trainer: 'CALDERON, J.',  type: 'Sign-off' },
  { date: '2026-05-15', member: 'BRENNAN, T.',   task: 'Daily Airfield Inspection',      trainer: 'AGUILAR, M.',   type: 'Sign-off' },
  { date: '2026-05-14', member: 'GREW, D.',      task: 'PPR Coordination',               trainer: 'JIMÉNEZ, P.',   type: 'Initial' },
  { date: '2026-05-13', member: 'IVERSON, L.',   task: 'Airfield Lighting Inspection',   trainer: 'ESPINOZA, R.',  type: 'Sign-off' },
  { date: '2026-05-13', member: 'BRENNAN, T.',   task: 'Movement Area Status Board',     trainer: 'AGUILAR, M.',   type: 'Initial' },
  { date: '2026-05-12', member: 'CALDERON, J.',  task: 'AMSL Position Sign-off',         trainer: 'DAVIDSON, K.',  type: 'Cert' },
  { date: '2026-05-11', member: 'GREW, D.',      task: 'NOTAM origination — Class I',    trainer: 'JIMÉNEZ, P.',   type: 'Initial' },
  { date: '2026-05-10', member: 'FOSTER, A.',    task: 'Movement Area Status Board',     trainer: 'CALDERON, J.',  type: 'Initial' },
];

// Aggregations
function rollupMember(m) {
  const jqsPct = Math.round(m.jqsDone / m.jqsReq * 100);
  const formalTotal = m.formal.totalHaf + m.formal.totalInit + m.formal.totalCont;
  const formalDone = m.formal.haf + m.formal.initial + m.formal.cont;
  const formalPct = formalTotal ? Math.round(formalDone / formalTotal * 100) : 0;
  return {
    ...m,
    jqsPct,
    formalDone, formalTotal, formalPct,
    overdueCount: m.over.length,
    dueSoonCount: m.dueSoon.length,
  };
}

const ROLLUP = UNIT_MEMBERS.map(rollupMember);

// Flat overdue/due-soon list across unit, sorted by date asc
const FLAT_DUES = [];
for (const m of UNIT_MEMBERS) {
  for (const o of m.over) FLAT_DUES.push({ ...o, member: m.name, severity: 'overdue', days: daysFromToday(o.due) });
  for (const o of m.dueSoon) FLAT_DUES.push({ ...o, member: m.name, severity: 'due-soon', days: daysFromToday(o.due) });
}
FLAT_DUES.sort((a, b) => a.days - b.days);

// Unit-wide KPIs (drawn from rollups + recurring catalogs)
function unitKPIs() {
  const totalMembers = ROLLUP.length;
  const totalReq = REC_TASKS_1098.reduce((s, t) => s + t.req, 0)
                 + REC_TASKS_RAT.reduce((s, t) => s + t.req, 0);
  const totalComp = REC_TASKS_1098.reduce((s, t) => s + t.comp, 0)
                  + REC_TASKS_RAT.reduce((s, t) => s + t.comp, 0);
  const totalDue = REC_TASKS_1098.reduce((s, t) => s + t.due, 0)
                 + REC_TASKS_RAT.reduce((s, t) => s + t.due, 0);
  const totalOver = REC_TASKS_1098.reduce((s, t) => s + t.over, 0)
                  + REC_TASKS_RAT.reduce((s, t) => s + t.over, 0);
  return { totalMembers, totalReq, totalComp, totalDue, totalOver };
}

// Quals & SEI matrix
const QUAL_COLS = [
  { key: 'qtp5L',  label: '5L QTP' },
  { key: 'qtp7L',  label: '7L QTP' },
  { key: 'amsl',   label: 'AMSL PCG' },
  { key: 'afm',    label: 'AFM PCG' },
  { key: 'sei155', label: 'SEI 155' },
  { key: 'sei368', label: 'SEI 368' },
  { key: 'sei090', label: 'SEI 090' },
  { key: 'sei3LZ', label: 'SEI 3LZ' },
];
function qualValue(m, key) {
  if (key === 'qtp5L')  return m.qtp.includes('5L');
  if (key === 'qtp7L')  return m.qtp.includes('7L');
  if (key === 'amsl')   return m.qtp.includes('AMSL');
  if (key === 'afm')    return m.qtp.includes('AFM');
  if (key.startsWith('sei')) return m.sei.includes(key.replace('sei',''));
  return false;
}

window.REPORTS_DATA = {
  TODAY,
  ROLLUP,
  REC_TASKS_1098,
  REC_TASKS_RAT,
  RECENT_797,
  FLAT_DUES,
  KPIS: unitKPIs(),
  QUAL_COLS,
  qualValue,
  daysFromToday,
};
