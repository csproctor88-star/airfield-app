/* global React */
// ============================================================
// Data store: localStorage + initial shells per member
// Each member has an ETR object with one section per tab.
// ============================================================

const STORAGE_KEY = "amtr_v1";

function uid(prefix = "id") {
  return prefix + "_" + Math.random().toString(36).slice(2, 9);
}

// ---------- shells (empty templates) ----------

function emptyCover() {
  return {
    fullName: "",
    grade: "",
    dafsc: "",
    unit: "",
    installation: "",
    dateAssigned: "",
    status: "",
    tsc: "",
    dutyPosition: "",
    supervisor: "",
    utm: "",
    commander: "",
  };
}

function emptyQualifications() {
  return {
    qtps: [
      { id: uid("q"), name: "5-Level Qualification Training Package", completeDate: "", ecd: "", lessons: [] },
      { id: uid("q"), name: "7-Level QTP", completeDate: "", ecd: "", lessons: [] },
      { id: uid("q"), name: "Airfield Manager Position Certification Guide", completeDate: "", ecd: "", lessons: [] },
    ],
    yesNo: [
      { id: uid("yn"), name: "Trainer", value: "No" },
      { id: uid("yn"), name: "Certifier", value: "No" },
      { id: uid("yn"), name: "3-Skill Level (1C731)", value: "No" },
      { id: uid("yn"), name: "5-Skill Level (1C751)", value: "No" },
      { id: uid("yn"), name: "7-Skill Level (1C771)", value: "No" },
      { id: uid("yn"), name: "9-Skill Level (1C791)", value: "No" },
      { id: uid("yn"), name: "SEI 155", value: "No" },
      { id: uid("yn"), name: "SEI 368", value: "No" },
      { id: uid("yn"), name: "SEI 090", value: "No" },
      { id: uid("yn"), name: "SEI 3LZ", value: "No" },
    ],
  };
}

function emptyFormalTraining() {
  // Per-member legacy structure (kept for back-compat; superseded by org-level catalog + per-member progress).
  return { haf: [], initial: [], continuation: [] };
}

// Org-level Formal Training catalog (course titles shared across all members).
function defaultFormalCatalog() {
  return {
    haf: [
      { id: uid("ft"), course: "HAF - Basic Military Training" },
      { id: uid("ft"), course: "HAF - Airfield Management Apprentice Course" },
      { id: uid("ft"), course: "HAF - AF Training Course" },
      { id: uid("ft"), course: "HAF - Airman Leadership School" },
      { id: uid("ft"), course: "HAF - Airfield Management Craftsman Course" },
      { id: uid("ft"), course: "HAF - USAF NCO Academy" },
      { id: uid("ft"), course: "HAF - Advanced Airfield Manager Course" },
      { id: uid("ft"), course: "HAF - USAF SNCO Academy" },
      { id: uid("ft"), course: "HAF - LZSO Course" },
    ],
    initial: [
      { id: uid("ft"), course: "Airfield Driving CBT" },
      { id: uid("ft"), course: "Airfield Criteria CBT" },
      { id: uid("ft"), course: "Airfield Inspections and Maintenance CBT" },
      { id: uid("ft"), course: "Wildlife Hazard Management CBT" },
      { id: uid("ft"), course: "Level 1 Anti-Terrorism Awareness Training CBT" },
      { id: uid("ft"), course: "Counterintelligence Awareness and Security Brief CBT" },
      { id: uid("ft"), course: "Operations Security Training AFI 10-701" },
      { id: uid("ft"), course: "Supervisor Safety Course" },
      { id: uid("ft"), course: "C2IMERA - AMOPS 201" },
    ],
    continuation: [
      { id: uid("ft"), course: "HAF - Risk Management Application and Integration (RM A&I)" },
      { id: uid("ft"), course: "HAF - Flight Safety Non-Commissioned Officer" },
      { id: uid("ft"), course: "HAF - Military Airspace Management" },
      { id: uid("ft"), course: "HAF - Aircraft Mishap Investigation Course" },
      { id: uid("ft"), course: "NGB - Airfield Management Domestic/Contingency Operations Workshop (DCOW)" },
      { id: uid("ft"), course: "AAAE - Basic Airport Safety & Operations Specialist School" },
      { id: uid("ft"), course: "AAAE - Advanced Airport Safety & Operations Specialist School (ASOS)" },
      { id: uid("ft"), course: "AAAE - International Aerodrome Certified Employee (IACE)" },
      { id: uid("ft"), course: "AAAE - Airport Certified Employee (ACE)" },
      { id: uid("ft"), course: "AAAE - Certified Member (CM)" },
      { id: uid("ft"), course: "AF COOL - Project Management Professional (PMP)" },
    ],
  };
}

function empty623A() {
  return [];
}

function empty797() {
  return [];
}

function empty803() {
  return {
    apprenticeGrad: { tasks: [] },
    amslAmos: { tasks: [] },
    fiveLevel: { tasks: [] },
    sevenLevel: { tasks: [] },
    afm: { tasks: [] },
  };
}

function emptyMilestones() {
  // Each milestone tab: STS items grouped by "phase" (day buckets)
  return {
    fiveLevelQtp: {
      title: "5-Level QTP Milestones",
      blurb: "Start within 60 days of date entered 5-skill level upgrade training. Minimum 180 days to complete.",
      phases: [
        { id: uid("ph"), label: "Required Milestones", items: [
          { id: uid("mi"), stsItems: "1.1. - 1.2.",                                                                              topic: "Career Progression",                                            completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "2.3 - 2.9.",                                                                               topic: "Administrative Management",                                     completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "3.1. - 3.2.",                                                                              topic: "Contingency/Expeditionary Operations",                          completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "3.10.1. - 3.10.3., 3.10.6. - 3.10.10.",                                                    topic: "Airfield Surveys",                                              completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "4.1. - 4.9., 25.1 - 25.15.",                                                               topic: "Support Agencies",                                              completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "5.1. - 5.3.",                                                                              topic: "Communications System",                                         completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "6.1. - 6.5.4.",                                                                            topic: "Notice to Airmen (NOTAM)",                                      completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "7.3.1. - 7.3.5.",                                                                          topic: "Snow and Ice Control",                                          completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "7.4.1. - 7.4.3., 7.4.5. - 7.4.6., 7.4.8",                                                  topic: "Bird/Wildlife Aircraft Strike Hazard (BASH) Reduction Program", completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "7.5.1 - 7.5.2.2., 7.5.4 - 7.5.7.2., 7.7.1. - 7.7.2.",                                      topic: "Airfield Driving Program",                                      completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "7.6.1. - 7.6.2.",                                                                          topic: "Security",                                                      completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "7.8.1.",                                                                                   topic: "Air Force Inspection System",                                   completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "8.1.1.-8.1.14.1., 8.1.17.1.-8.1.17.5., 8.4.1.-8.5.1., 8.5.3., 8.6.1.1.-8.6.1.5.8., 8.6.3.", topic: "Airfield Design Criteria",                                      completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "9.2.1.- 9.2.11.",                                                                          topic: "Airfield Safety",                                               completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "10.1 - 10.2.",                                                                             topic: "Airfield Resources Protection",                                 completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "11.1.-11.3., 11.6., 11.8.",                                                                topic: "Airfield Pavements",                                            completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "12.1.-12.3., 12.5.-12.12.4.",                                                              topic: "Airfield Markings",                                             completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "13.1.-13.12., 13.16.1.-13.16.5.",                                                          topic: "Airfield Lighting",                                             completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "14.1. - 14.5.",                                                                            topic: "Airfield Signs",                                                completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "15.1. - 15.3.",                                                                            topic: "Aircraft Arresting Systems",                                    completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "16.1.1.-16.8., 16.10.",                                                                    topic: "Airfield Waivers",                                              completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "7.1. & 17.1.1.-17.4.9., 17.4.11., 17.6.1.-17.8.1.",                                        topic: "Airfield Inspections",                                          completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "18.1.1.-18.1.8., 18.1.10.",                                                                topic: "Airfield Checks",                                               completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "19.1.-19.7. & 23.1.",                                                                      topic: "Coordinate Airfield Repair Activities & Facilities Maintenance", completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "21.1., 21.3-21.4.",                                                                        topic: "Airfield Safety Management",                                    completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "26.1., 26.3.",                                                                             topic: "Civil Aircraft Use of USAF Installations",                      completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "28.1.-28.7.",                                                                              topic: "Impose Airfield Restrictions",                                  completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "29.1.-29.5., 29.7., 29.9.",                                                                topic: "Emergency Management",                                          completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "30.1.-30.2.",                                                                              topic: "National Airspace System",                                      completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "31.1.-31.2.",                                                                              topic: "Flight Planning Room",                                          completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "32.1.-32.14.",                                                                             topic: "Flight Information Publications (FLIPs)",                       completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "33.1.-33.3.",                                                                              topic: "Aircraft Inventory",                                            completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "34.1.-34.5.5.",                                                                            topic: "Flight Plans",                                                  completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "35.1.-35.3.",                                                                              topic: "Airfield Management Training Program",                          completed: false, completedDate: "", certifierInitials: "" },
        ] },
      ],
    },
    amosAmslPcg: {
      title: "AMOS/AMSL PCG Milestones",
      blurb: "Start this PCG no later than 180 days after the completion of the 5-level QTP. Individuals have 90 days to completed this PCG.",
      phases: [
        { id: uid("ph"), label: "Required Milestones", items: [
          { id: uid("mi"), stsItems: "", topic: "Airfield Management Operations Lead/Supervisor Responsibilities/Authority Leadership", completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "", topic: "Events Log/Shift Change Brief Review", completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "", topic: "Airfield Inspections", completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "", topic: "Flight Plan Processing Procedures", completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "", topic: "Training Program", completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "", topic: "On-The-Job Training Administration", completed: false, completedDate: "", certifierInitials: "" },
        ] },
      ],
    },
    sevenLevelQtp: {
      title: "7-Level QTP Milestones",
      blurb: "Open upon entry to 7-skill level upgrade training. Members have 6 months to complete.",
      phases: [
        { id: uid("ph"), label: "Required Milestones", items: [
          { id: uid("mi"), stsItems: "2.2.",                                topic: "Administrative Management",            completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "3.3-3.4., 3.7",                       topic: "Contingency/Expeditionary Operations", completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "7.4.4.",                              topic: "Bird Hazard Working Group (BHWG)",     completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "7.5.3.",                              topic: "Airfield Driving Program",             completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "11.7",                                topic: "Pavements",                            completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "16.11",                               topic: "Airfield Waivers",                     completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "20.1",                                topic: "Joint Inspections",                    completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "29.8",                                topic: "Emergency Management",                 completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "36.1.-36.7.",                         topic: "NAMT Position Responsibilities",       completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "18.1.11., 29.6., 37.1-37.3",          topic: "NAMO Position Responsibilities",       completed: false, completedDate: "", certifierInitials: "" },
        ] },
      ],
    },
    afmPcg: {
      title: "Airfield Manager PCG Milestones",
      blurb: "Start upon notification of selection for promotion to Technical Sergeant. 180 days to complete.",
      phases: [
        { id: uid("ph"), label: "Required Milestones", items: [
          { id: uid("mi"), stsItems: "", topic: "Airfield Manager Roles/Responsibilities/Authority Leadership", completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "", topic: "Personnel Utilization & Management",                          completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "", topic: "Security/Airfield Resource Protection",                       completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "", topic: "Training Program Oversight",                                  completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "", topic: "Navigational Aids (NAVAIDS)",                                 completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "", topic: "Safety and Hazardous Conditions on the Airfield",             completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "", topic: "Aircraft Mishap Management",                                  completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "", topic: "Airfield Lighting Systems and Maintenance",                   completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "", topic: "Airfield Markings and Maintenance",                           completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "", topic: "Airfield Pavement Conditions",                                completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "", topic: "Airfield Inspections and Checks",                             completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "", topic: "Airfield Maintenance and Construction",                       completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "", topic: "Airfield Waivers",                                            completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "", topic: "Snow & Ice Control",                                          completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "", topic: "Aircraft Arresting Systems & Certification",                  completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "", topic: "Aircraft Parking Plans",                                      completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "", topic: "Contingency/Expeditionary Plans and Operations",              completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "", topic: "Civil/Foreign Aircraft Use of USAF Airfields",                completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "", topic: "Aerial Events/Open Houses",                                   completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "", topic: "Air Installations Compatibility Use Zone (AICUZ)",            completed: false, completedDate: "", certifierInitials: "" },
          { id: uid("mi"), stsItems: "", topic: "The Inspection System",                                       completed: false, completedDate: "", certifierInitials: "" },
        ] },
      ],
    },
  };
}

function emptyJqs() {
  return [];
}

function emptyFiles() {
  return [];
}

function emptyRAT() {
  return {
    items: [
      { id: uid("rat"), course: "Active Threat Response",                    category: "Force Protection", completed: "", due: "", method: "CBT", status: "Upcoming" },
      { id: uid("rat"), course: "Basic Communication",                       category: "Career",           completed: "", due: "", method: "CBT", status: "Upcoming" },
      { id: uid("rat"), course: "Chemical, Biological, Radiological, Nuclear", category: "Readiness",      completed: "", due: "", method: "CBT", status: "Upcoming" },
      { id: uid("rat"), course: "Comprehensive Airman Fitness",              category: "Wellness",         completed: "", due: "", method: "Read", status: "Upcoming" },
      { id: uid("rat"), course: "Cross-Cultural Communication",              category: "Career",           completed: "", due: "", method: "Read", status: "Upcoming" },
      { id: uid("rat"), course: "Explosive Ordnance Hazards",                category: "Readiness",        completed: "", due: "", method: "Read", status: "Upcoming" },
      { id: uid("rat"), course: "Information Environment Awareness",         category: "OPSEC",            completed: "", due: "", method: "CBT", status: "Upcoming" },
      { id: uid("rat"), course: "Integrated Defense",                        category: "Force Protection", completed: "", due: "", method: "CBT", status: "Upcoming" },
      { id: uid("rat"), course: "Law of War",                                category: "Legal",            completed: "", due: "", method: "Read", status: "Upcoming" },
      { id: uid("rat"), course: "Small Arms",                                category: "Weapons",          completed: "", due: "", method: "Hands-on", status: "Upcoming" },
      { id: uid("rat"), course: "Survival, Evasion, Resistance and Escape",  category: "Readiness",        completed: "", due: "", method: "CBT", status: "Upcoming" },
      { id: uid("rat"), course: "Tactical Combat Casualty Care: Tier 1",     category: "Medical",          completed: "", due: "", method: "Hands-on", status: "Upcoming" },
      { id: uid("rat"), course: "Weapons Qualification",                     category: "Weapons",          completed: "", due: "", method: "Hands-on", status: "Upcoming" },
    ],
  };
}

function empty1098Year(year) {
  return {
    year,
    items: [],
  };
}

function empty1098() {
  return {
    currentYear: "2026",
    years: {
      "2026": empty1098Year("2026"),
      "2025": empty1098Year("2025"),
    },
  };
}

// ---------- shared org-level 1098 catalog ----------
function defaultRt1098Tasks() {
  return [
    { id: uid("rt"), task: "Airfield Driving",                                  type: "", frequency: "Annual"  },
    { id: uid("rt"), task: "Bird/Wildlife Control (Active/Passive Methods)",    type: "", frequency: "Annual"  },
    { id: uid("rt"), task: "Snow and Ice Control",                              type: "", frequency: "Annual"  },
    { id: uid("rt"), task: "Generator Start-Up / Power Transfer",               type: "", frequency: "Annual"  },
    { id: uid("rt"), task: "Fire Extinguisher Training",                        type: "", frequency: "Annual"  },
    { id: uid("rt"), task: "Emergency Evac / Alternate Facility Procedures",    type: "", frequency: "Annual"  },
    { id: uid("rt"), task: "Base Support Plan (AFI 10-404)",                    type: "", frequency: "Annual"  },
    { id: uid("rt"), task: "Records Management User Training",                  type: "", frequency: "Annual"  },
    { id: uid("rt"), task: "Mandatory Controlled Unclassified Info Training",   type: "", frequency: "Annual"  },
    { id: uid("rt"), task: "AFI 13-207 Preventing & Resisting Aircraft Piracy", type: "", frequency: "Annual"  },
    { id: uid("rt"), task: "Aircraft Characteristics / Performance",            type: "", frequency: "Annual"  },
    { id: uid("rt"), task: "January Monthly Proficiency Test",                  type: "", frequency: "Monthly" },
    { id: uid("rt"), task: "February Monthly Proficiency Test",                 type: "", frequency: "Monthly" },
    { id: uid("rt"), task: "March Monthly Proficiency Test",                    type: "", frequency: "Monthly" },
    { id: uid("rt"), task: "April Monthly Proficiency Test",                    type: "", frequency: "Monthly" },
    { id: uid("rt"), task: "May Monthly Proficiency Test",                      type: "", frequency: "Monthly" },
    { id: uid("rt"), task: "June Monthly Proficiency Test",                     type: "", frequency: "Monthly" },
    { id: uid("rt"), task: "July Monthly Proficiency Test",                     type: "", frequency: "Monthly" },
    { id: uid("rt"), task: "August Monthly Proficiency Test",                   type: "", frequency: "Monthly" },
    { id: uid("rt"), task: "September Monthly Proficiency Test",                type: "", frequency: "Monthly" },
    { id: uid("rt"), task: "October Monthly Proficiency Test",                  type: "", frequency: "Monthly" },
    { id: uid("rt"), task: "November Monthly Proficiency Test",                 type: "", frequency: "Monthly" },
    { id: uid("rt"), task: "December Monthly Proficiency Test",                 type: "", frequency: "Monthly" },
  ];
}

function emptyRt1098() {
  return {
    tasks: defaultRt1098Tasks(),
    years: ["2026", "2025"],
    currentYear: "2026",
  };
}

function emptyMember(name = "", grade = "", dafsc = "", unit = "") {
  const cover = emptyCover();
  cover.fullName = name;
  cover.grade = grade;
  cover.dafsc = dafsc;
  cover.unit = unit;
  return {
    id: uid("mbr"),
    cover,
    qualifications: emptyQualifications(),
    formalTraining: emptyFormalTraining(),
    daf623a: empty623A(),
    daf797: empty797(),
    daf803: empty803(),
    milestones: emptyMilestones(),
    daf1098: empty1098(),
    daf1098Progress: {},
    formalTrainingProgress: {},
    jqs: emptyJqs(),
    jqsProgress: {},
    files: emptyFiles(),
    rat: emptyRAT(),
  };
}

// ---------- proficiency code key (read-only reference) ----------
const PROFICIENCY_KEY = {
  performance: [
    { code: "1", label: "Extremely Limited", desc: "Can do simple parts of the task. Needs to be told or shown how to do most of the task." },
    { code: "2", label: "Partially Proficient", desc: "Can do most parts of the task. Needs only help on hardest parts." },
    { code: "3", label: "Competent", desc: "Can do all parts of the task. Needs only a spot check of completed work." },
    { code: "4", label: "Highly Proficient", desc: "Can do the complete task quickly and accurately. Can tell or show others how to do the task." },
  ],
  knowledge: [
    { code: "a", label: "Nomenclature", desc: "Can name parts, tools, and simple facts about the task." },
    { code: "b", label: "Procedures", desc: "Can determine step by step procedures for doing the task." },
    { code: "c", label: "Operating Principles", desc: "Can identify why and when the task must be done and why each step is needed." },
    { code: "d", label: "Advanced Theory", desc: "Can predict, isolate, and resolve problems about the task." },
  ],
  subject: [
    { code: "A", label: "Facts", desc: "Can identify basic facts and terms about the subject." },
    { code: "B", label: "Principles", desc: "Can identify relationship of basic facts and state general principles about the subject." },
    { code: "C", label: "Analysis", desc: "Can analyze facts and principles and draw conclusions about the subject." },
    { code: "D", label: "Evaluation", desc: "Can evaluate conditions and make proper decisions about the subject." },
  ],
  marks: [
    { code: "*", desc: "Item identified for CBRN TQT as directed by Unit Commander." },
    { code: "-", desc: "Mark used alone instead of scale value to show no proficiency training is provided in the course. OJT provided at unit/base level." },
    { code: "^", desc: "Item requires third party certification." },
    { code: "+", desc: "Required prior to award of SEI 155; can only be performed upon completion of the AMOS/AMSL PCG." },
  ],
  notes: [
    "All tasks and knowledge items shown with a proficiency code are trained during wartime.",
    "Unit level tasks are trained and qualified to the 3c level.",
    "At a minimum, all core tasks must be trained to the knowledge base level.",
  ],
};

// ---------- Training Status Codes (A-Y) ----------
const TSC_TABLE = [
  { code: "A", desc: "Service member is in upgrade training for the initial award of a 3-skill level AFSC." },
  { code: "B", desc: "Service member is in upgrade training for the initial award of a 5-skill level AFSC." },
  { code: "C", desc: "Service member is in upgrade training for the initial award of a 7-skill level AFSC. The member must be an E-5 select or above." },
  { code: "D", desc: "AFR member awaiting reassignment to the Inactive Ready Reserve. Use only when member is within 6 months of the reassignment." },
  { code: "E", desc: "Service member is retraining and is in upgrade training for subsequent award of a 3-skill level AFSC." },
  { code: "F", desc: "Service member is retraining and is in upgrade training for subsequent award of a 5-skill level AFSC." },
  { code: "G", desc: "Service member is retraining and is in upgrade training for subsequent award of a 7-skill level AFSC. Member must be E-5 select or above." },
  { code: "I", desc: "Service member is in re-qualification training (E-4 to E-6 returned to AFSC at highest skill level for current grade; not performed in AFSC for past 6 months)." },
  { code: "K", desc: "Service member is attending Basic Military Training or a skill-level awarding technical school. Also applies to follow-on training." },
  { code: "M", desc: "Service member has approved retraining via formal school, control AFSC changed to retraining AFSC, waiting to attend class." },
  { code: "P", desc: "Service member cannot enter or continue in upgrade training due to lack of training capability or duty status." },
  { code: "Q", desc: "Service member is not in upgrade training, has received the highest skill-level possible at current grade, and is in qualification training for an assigned duty position." },
  { code: "R", desc: "Service member is fully qualified. Use when personnel complete upgrade training." },
  { code: "S", desc: "Service member is directly or indirectly changing to another AFSC at the same skill-level. Only AFPC will update this code." },
  { code: "T", desc: "Commander is not recommending the service member for entry into training or withdraws the member for failure to progress." },
  { code: "Y", desc: "Applicable TSC has not been assigned or the gaining Personnel Flight has not processed the member." },
];

// ---------- persistence ----------
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Migration: seed jqsCatalog if absent
    if (!parsed.jqsCatalog && window.__JQS_CATALOG) {
      parsed.jqsCatalog = JSON.parse(JSON.stringify(window.__JQS_CATALOG.catalog || []));
      parsed.jqsCatalogMeta = window.__JQS_CATALOG.meta || {};
    }
    // Migration: hoist 1098 catalog out of per-member daf1098
    if (!parsed.rt1098 && parsed.members) {
      parsed.rt1098 = migrate1098(parsed.members);
    }
    // Migration: hoist Formal Training catalog out of per-member formalTraining
    if (!parsed.formalCatalog && parsed.members) {
      parsed.formalCatalog = migrateFormalTraining(parsed.members);
    }
    return parsed;
  } catch (e) {
    console.warn("Failed to load saved state:", e);
    return null;
  }
}

// Build a shared rt1098 catalog from each member's old per-member daf1098 store.
// Returns { tasks, years, currentYear } and rewrites each member's daf1098Progress
// in place.
function migrate1098(members) {
  const taskMap = new Map(); // key: title|frequency -> { id, task, type, frequency }
  const yearsSet = new Set();
  let currentYear = "2026";

  for (const m of members) {
    const d = m && m.daf1098;
    if (!d) continue;
    if (d.currentYear) currentYear = d.currentYear;
    const yrs = d.years || {};
    for (const yKey of Object.keys(yrs)) {
      yearsSet.add(yKey);
      const items = (yrs[yKey] && yrs[yKey].items) || [];
      for (const it of items) {
        const title = (it.task || "").trim();
        if (!title) continue;
        const key = title.toLowerCase() + "|" + (it.frequency || "");
        if (!taskMap.has(key)) {
          taskMap.set(key, {
            id: uid("rt"),
            task: title,
            type: it.type || "",
            frequency: it.frequency || "Annual",
          });
        }
      }
    }
  }

  // If migration finds nothing (fresh users with no old data), seed from defaults
  let tasks;
  if (taskMap.size === 0) {
    tasks = defaultRt1098Tasks();
  } else {
    tasks = Array.from(taskMap.values());
  }
  const years = yearsSet.size ? Array.from(yearsSet).sort().reverse() : ["2026", "2025"];

  // Rewrite each member's progress
  for (const m of members) {
    const progress = {};
    const d = m && m.daf1098;
    if (d && d.years) {
      for (const yKey of Object.keys(d.years)) {
        const items = (d.years[yKey] && d.years[yKey].items) || [];
        progress[yKey] = {};
        for (const it of items) {
          const title = (it.task || "").trim();
          if (!title) continue;
          const key = title.toLowerCase() + "|" + (it.frequency || "");
          const taskRef = taskMap.get(key);
          if (!taskRef) continue;
          const hasData = it.startDate || it.lastCompleted || it.nextDue || it.certifier || it.traineeInitials || it.scoreOrHours;
          if (!hasData) continue;
          progress[yKey][taskRef.id] = {
            startDate: it.startDate || "",
            lastCompleted: it.lastCompleted || "",
            nextDue: it.nextDue || "",
            certifier: it.certifier || "",
            traineeInitials: it.traineeInitials || "",
            scoreOrHours: it.scoreOrHours || "",
          };
        }
      }
    }
    m.daf1098Progress = progress;
  }

  return { tasks, years, currentYear };
}

// Build a shared Formal Training catalog from each member's old per-member formalTraining store.
// Returns { haf, initial, continuation } and rewrites each member's formalTrainingProgress in place.
function migrateFormalTraining(members) {
  const sections = ["haf", "initial", "continuation"];
  const catalog = { haf: [], initial: [], continuation: [] };
  const keyMaps = { haf: new Map(), initial: new Map(), continuation: new Map() };

  // Collect unique course titles per section across all members
  for (const m of members) {
    const ft = m && m.formalTraining;
    if (!ft) continue;
    for (const sec of sections) {
      const items = ft[sec] || [];
      for (const it of items) {
        const title = (it.course || "").trim();
        if (!title) continue;
        const key = title.toLowerCase();
        if (!keyMaps[sec].has(key)) {
          const entry = { id: uid("ft"), course: title };
          keyMaps[sec].set(key, entry);
          catalog[sec].push(entry);
        }
      }
    }
  }

  // If no existing data, seed from defaults
  const isEmpty = sections.every(s => catalog[s].length === 0);
  const finalCatalog = isEmpty ? defaultFormalCatalog() : catalog;
  const finalKeyMaps = { haf: new Map(), initial: new Map(), continuation: new Map() };
  for (const sec of sections) {
    for (const entry of finalCatalog[sec]) {
      finalKeyMaps[sec].set((entry.course || "").toLowerCase(), entry);
    }
  }

  // Rewrite each member's progress keyed by catalog id
  for (const m of members) {
    const progress = {};
    const ft = m && m.formalTraining;
    if (ft) {
      for (const sec of sections) {
        const items = ft[sec] || [];
        for (const it of items) {
          const title = (it.course || "").trim();
          if (!title) continue;
          const entry = finalKeyMaps[sec].get(title.toLowerCase());
          if (!entry) continue;
          const hasData = it.startDate || it.completeDate;
          if (!hasData) continue;
          progress[entry.id] = {
            startDate: it.startDate || "",
            completeDate: it.completeDate || "",
          };
        }
      }
    }
    m.formalTrainingProgress = progress;
  }

  return finalCatalog;
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Failed to save state:", e);
  }
}

function initialState() {
  const saved = loadState();
  if (saved && saved.members && saved.members.length) return saved;

  // First-run sample: one sample airman + one empty slot
  const sample = emptyMember("Sample, Airman A.", "SrA / E-4", "1C751", "127 OSS / AM Ops");
  sample.cover.installation = "Selfridge ANGB";
  sample.cover.dateAssigned = "";
  sample.cover.status = "Active";
  sample.cover.tsc = "B";
  sample.cover.supervisor = "";
  sample.cover.utm = "";
  sample.cover.commander = "";

  return {
    activeMemberId: sample.id,
    role: "trainer", // "trainee" | "trainer" | "certifier" | "namt" | "afm"
    members: [sample],
    jqsCatalog: window.__JQS_CATALOG ? JSON.parse(JSON.stringify(window.__JQS_CATALOG.catalog || [])) : [],
    jqsCatalogMeta: window.__JQS_CATALOG ? (window.__JQS_CATALOG.meta || {}) : {},
    rt1098: emptyRt1098(),
    formalCatalog: defaultFormalCatalog(),
  };
}

window.AMTR_Store = {
  STORAGE_KEY,
  uid,
  emptyMember,
  emptyCover,
  emptyQualifications,
  emptyFormalTraining,
  empty623A,
  empty797,
  empty803,
  emptyMilestones,
  empty1098,
  empty1098Year,
  emptyRt1098,
  defaultRt1098Tasks,
  defaultFormalCatalog,
  emptyJqs,
  emptyFiles,
  emptyRAT,
  initialState,
  loadState,
  saveState,
  PROFICIENCY_KEY,
  TSC_TABLE,
};
