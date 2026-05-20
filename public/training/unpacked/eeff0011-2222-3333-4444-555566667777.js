/* global XLSX */
// Excel importer — builds a new training-record member from one or two .xlsx files.
// Maps per agreed spec:
//   Qualifications sheet → Cover (name/rank/DAFSC/TSC/duty position) + Qualifications (QTPs + Yes/No)
//   Formal Training sheet → formalCatalog (extend if needed) + formalTrainingProgress
//   JQS-CFETP sheet     → jqsProgress[number]
//   623A sheet          → daf623a[]  (parse trailing " / XX" initials into Signature blocks)
//   DAF Form 797 sheet  → daf797[]   (Local Milestones intentionally skipped; dup rows merged)
//   DAF 1098 2025/2026  → daf1098Progress[year][taskId] (extend catalog if needed)
//
// Ignored entirely: Cover sheet, all 803 sheets, milestone sheets, Proficiency Code Key, Ready Airman Training, Sheet18.

(function() {
  // AMTR_Store is loaded by a text/babel script that runs AFTER our IIFE,
  // so access it lazily at call time, not at module init.
  const getStore = () => window.AMTR_Store;

  // ---------------- date helpers ----------------
  function ymd(y, m, d) {
    return y + '-' + String(m).padStart(2,'0') + '-' + String(d).padStart(2,'0');
  }
  function fmtDate(d) { return ymd(d.getFullYear(), d.getMonth()+1, d.getDate()); }
  const MONTHS = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };

  function toISODate(v) {
    if (v == null || v === '') return '';
    if (v instanceof Date && !isNaN(v)) return fmtDate(v);
    if (typeof v === 'number') {
      if (typeof XLSX !== 'undefined' && XLSX.SSF && XLSX.SSF.parse_date_code) {
        const d = XLSX.SSF.parse_date_code(v);
        if (d) return ymd(d.y, d.m, d.d);
      }
      return '';
    }
    if (typeof v !== 'string') return '';
    let s = v.trim();
    if (!s) return '';
    // YYYY-MM-DD
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
    if (m) return ymd(parseInt(m[1],10), parseInt(m[2],10), parseInt(m[3],10));
    // M/D/YY or M/D/YYYY  (also handles "M/D/YY/" with trailing slash)
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\/?$/.exec(s);
    if (m) {
      let y = parseInt(m[3], 10); if (y < 100) y += 2000;
      return ymd(y, parseInt(m[1],10), parseInt(m[2],10));
    }
    // 12/31//2024  (double slash, observed in one row of the test file)
    m = /^(\d{1,2})\/(\d{1,2})\/+(\d{4})$/.exec(s);
    if (m) return ymd(parseInt(m[3],10), parseInt(m[1],10), parseInt(m[2],10));
    // D-MMM-YY / D-MMM-YYYY
    m = /^(\d{1,2})[-\s]([A-Za-z]{3})[-\s](\d{2,4})$/.exec(s);
    if (m) {
      const mo = MONTHS[m[2].toLowerCase()];
      if (mo) { let y = parseInt(m[3],10); if (y < 100) y += 2000; return ymd(y, mo, parseInt(m[1],10)); }
    }
    // D-MMM (no year — fall back to current year)
    m = /^(\d{1,2})[-\s]([A-Za-z]{3})$/.exec(s);
    if (m) {
      const mo = MONTHS[m[2].toLowerCase()];
      if (mo) return ymd(new Date().getFullYear(), mo, parseInt(m[1],10));
    }
    // Last-resort: native parser
    const d = new Date(s);
    if (!isNaN(d.getTime())) return fmtDate(d);
    return '';
  }

  // ---------------- sheet helpers ----------------
  function rowsFor(ws) {
    if (!ws) return [];
    return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false, raw: false });
  }
  function norm(s) { return (s == null ? '' : s.toString()).trim().toLowerCase().replace(/\s+/g, ' '); }

  // Find sheet across multiple workbooks (case-insensitive). pattern: string or RegExp.
  function findSheet(wbs, pattern) {
    const isRe = pattern instanceof RegExp;
    for (const { wb } of wbs) {
      for (const name of wb.SheetNames) {
        if (isRe ? pattern.test(name) : name.toLowerCase() === pattern.toLowerCase()) {
          return wb.Sheets[name];
        }
      }
    }
    return null;
  }

  // ---------------- title casing (for new catalog entries from ALLCAPS excel) ----------------
  const SMALL = new Set(['a','an','and','as','at','but','by','for','if','in','of','on','or','the','to','via','vs']);
  function titleCase(s) {
    if (!s) return s;
    const cleaned = s.toString().replace(/\s+/g, ' ').trim();
    // If string contains lowercase already, leave it.
    if (/[a-z]/.test(cleaned) && !/^[A-Z\s\d\W]+$/.test(cleaned)) return cleaned;
    return cleaned.toLowerCase().split(' ').map((w, i) => {
      // Preserve uppercase acronyms like AFI, DAF, OPSEC, CBT
      const bare = w.replace(/[^a-z0-9]/g,'');
      if (i > 0 && SMALL.has(bare)) return w;
      // Capitalize first alphabetic char
      return w.replace(/[a-z]/, c => c.toUpperCase());
    }).join(' ');
  }

  // ---------------- Cover + Qualifications ----------------
  function parseQualificationsSheet(ws) {
    const out = { cover: {}, qtps: [], yesNo: [] };
    if (!ws) return out;
    const rows = rowsFor(ws);
    // Pull labeled fields from the top of the sheet
    for (let i = 0; i < Math.min(rows.length, 8); i++) {
      for (let j = 0; j < rows[i].length; j++) {
        const cell = (rows[i][j] || '').toString();
        const m = /^\s*([A-Za-z][A-Za-z ]+):\s*(.*)$/.exec(cell);
        if (!m) continue;
        const k = m[1].trim().toLowerCase();
        const v = m[2].trim();
        if (!v) continue;
        if (k === 'name') {
          // "Last - First - M." -> "Last, First M."
          const parts = v.split(/\s*-\s*/).map(s=>s.trim()).filter(Boolean);
          out.cover.fullName = parts.length >= 2 ? parts[0] + ', ' + parts.slice(1).join(' ') : v;
        } else if (k === 'rank') out.cover.grade = v;
        else if (k === 'dafsc') out.cover.dafsc = v;
        else if (k === 'tsc' || k === 'training status code') out.cover.tsc = v;
        else if (k === 'current duty position' || k === 'duty position') out.cover.dutyPosition = v;
      }
    }
    // QTPs and Yes/No section markers
    let mode = '';
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const a = (r[0] || '').toString().trim();
      const b = (r[1] || '').toString().trim();
      if (/^Qualification\s*$/i.test(a) && /complete\s*date/i.test(b)) { mode = 'qtp'; continue; }
      if (!a && /\(yes\s*\/\s*no\)/i.test(b)) { mode = 'yn'; continue; }
      if (/^Training Status Code\s*$/i.test(a)) break; // reached the TSC reference table — stop
      if (!a) continue;
      if (mode === 'qtp') out.qtps.push({ name: a, completeDate: toISODate(r[1]) });
      else if (mode === 'yn') out.yesNo.push({ name: a, value: /^yes$/i.test(b) ? 'Yes' : (/^no$/i.test(b) ? 'No' : '') });
    }
    return out;
  }

  function mapQtpToHtml(excelName) {
    // Reject the ones the spec says to ignore (AMOS/AMSL PCG, KMTC local PCG, etc.)
    if (/operations\s+supervisor|amos|amsl|shift\s+lead/i.test(excelName)) return null;
    if (/local\s+pcg|kmtc/i.test(excelName)) return null;
    if (/5-?level/i.test(excelName))                                     return '5-Level Qualification Training Package';
    if (/7-?level/i.test(excelName))                                     return '7-Level QTP';
    if (/airfield\s+manager\s+position\s+certification\s+guide/i.test(excelName)) return 'Airfield Manager Position Certification Guide';
    return null;
  }
  function mapYnToHtml(excelName) {
    if (/^trainer$/i.test(excelName))   return 'Trainer';
    if (/^certifier$/i.test(excelName)) return 'Certifier';
    if (/1C731/i.test(excelName)) return '3-Skill Level (1C731)';
    if (/1C751/i.test(excelName)) return '5-Skill Level (1C751)';
    if (/1C771/i.test(excelName)) return '7-Skill Level (1C771)';
    if (/1C791/i.test(excelName)) return '9-Skill Level (1C791)';
    if (/SEI\s*155/i.test(excelName)) return 'SEI 155';
    if (/SEI\s*368/i.test(excelName)) return 'SEI 368';
    if (/SEI\s*090/i.test(excelName)) return 'SEI 090';
    if (/SEI\s*3LZ/i.test(excelName))  return 'SEI 3LZ';
    return null;
  }

  // ---------------- 623A ----------------
  function parseSlashInitials(text) {
    if (text == null) return { comment: '', initials: '' };
    const s = text.toString();
    const trimmed = s.trim();
    // Must end with " / XX" or " / XYZ" — letters only, after a forward slash with surrounding whitespace.
    const m = /^([\s\S]*?\S)\s+\/\s+([A-Za-z]{2,3})\s*$/.exec(trimmed);
    if (m) return { comment: m[1].replace(/\s+$/,''), initials: m[2].toUpperCase() };
    return { comment: s, initials: '' };
  }
  function parse623A(ws) {
    const out = [];
    if (!ws) return out;
    const rows = rowsFor(ws);
    // Locate header row "Record Date / Record Type/Title / ..."
    let header = -1;
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      const r = rows[i].map(c => (c||'').toString().toLowerCase());
      if (r[0] === 'record date') { header = i; break; }
    }
    if (header < 0) return out;
    for (let i = header + 1; i < rows.length; i++) {
      const r = rows[i];
      const date = toISODate(r[0]);
      const type = (r[1] || '').toString().trim();
      if (!date && !type) continue;
      const trainee = parseSlashInitials(r[2]);
      const trainer = parseSlashInitials(r[3]);
      const namt    = parseSlashInitials(r[4]);
      const afm     = parseSlashInitials(r[5]);
      out.push({
        id: getStore().uid('e'),
        date, type,
        traineeComment: trainee.comment, traineeInitials: trainee.initials,
        trainerComment: trainer.comment, trainerInitials: trainer.initials,
        namtComment:    namt.comment,    namtInitials:    namt.initials,
        afmComment:     afm.comment,     afmInitials:     afm.initials,
      });
    }
    return out;
  }

  // ---------------- 797 ----------------
  function parse797(ws) {
    const out = [];
    if (!ws) return out;
    const rows = rowsFor(ws);
    let header = -1;
    for (let i = 0; i < Math.min(rows.length, 6); i++) {
      const r = rows[i].map(c => (c||'').toString().toLowerCase());
      if (r[0] === 'task title' && (r[1] || '').includes('start')) { header = i; break; }
    }
    if (header < 0) return out;
    const seen = new Set();
    for (let i = header + 1; i < rows.length; i++) {
      const r = rows[i];
      const task = (r[0] || '').toString().trim();
      if (!task) continue;
      const startDate    = toISODate(r[1]);
      const completeDate = toISODate(r[2]);
      const trainee      = (r[3] || '').toString().trim().toUpperCase();
      const trainer      = (r[4] || '').toString().trim().toUpperCase();
      const cert         = (r[5] || '').toString().trim().toUpperCase();
      const key = norm(task) + '|' + startDate + '|' + completeDate + '|' + trainee;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: getStore().uid('t'),
        task,
        requiresCertifier: !!cert,
        startDate, completeDate,
        traineeInitials: trainee,
        trainerInitials: trainer,
        certifierInitials: cert,
        milestones: '', // Local milestones intentionally blank per spec — manual entry only
      });
    }
    return out;
  }

  // ---------------- 1098 ----------------
  // Roll a complete-date forward by the catalog frequency to get the "next due" date.
  // Mirrors computeNextDue() in tab-1098.jsx so an imported record matches what the UI
  // would have produced if the user had typed the complete date in by hand.
  function rollForward(completeISO, frequency) {
    if (!completeISO) return '';
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(completeISO);
    if (!m) return '';
    let y = parseInt(m[1],10), mo = parseInt(m[2],10) - 1, d = parseInt(m[3],10);
    const f = (frequency || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (/^monthly$/.test(f)) mo += 1;
    else if (/^quarterly$/.test(f)) mo += 3;
    else if (/^semi.?annual$/.test(f)) mo += 6;
    else if (/^annual$/.test(f) || /^1\s*(yr|year)s?$/.test(f)) y += 1;
    else if (/^2\s*(yr|year)s?$/.test(f)) y += 2;
    else if (/^3\s*(yr|year)s?$/.test(f)) y += 3;
    else if (/^5\s*(yr|year)s?$/.test(f)) y += 5;
    else y += 1; // default Annual when frequency unknown
    // Re-normalize the month
    const dt = new Date(y, mo, d);
    return ymd(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
  }

  function parse1098(ws) {
    if (!ws) return [];
    const rows = rowsFor(ws);
    let header = -1;
    for (let i = 0; i < Math.min(rows.length, 6); i++) {
      const r = rows[i].map(c => (c||'').toString().toLowerCase());
      if (r[0] === 'task title') { header = i; break; }
    }
    if (header < 0) return [];
    const out = [];
    for (let i = header + 1; i < rows.length; i++) {
      const r = rows[i];
      const task = (r[0] || '').toString().trim();
      if (!task) continue;
      out.push({
        task,
        startDate:       toISODate(r[1]),
        completeDate:    toISODate(r[2]),
        certInitials:    (r[3] || '').toString().trim().toUpperCase(),
        traineeInitials: (r[4] || '').toString().trim().toUpperCase(),
        scoreOrHours:    (r[5] || '').toString().trim(),
        type:            (r[6] || '').toString().trim(),
        frequency:       (r[7] || '').toString().trim(),
        dueDate:         toISODate(r[8]),
      });
    }
    return out;
  }

  // Match excel 1098 task to a catalog task. Returns catalog task id or null.
  // Strategy: normalize aggressively (strip parens, AFI numbers, punctuation) then Jaccard on token sets.
  function tokensOf(s) {
    return new Set(
      s.toLowerCase()
        .replace(/\(.*?\)/g, ' ')
        .replace(/afi\s*\d+[-\d]*/gi, ' ')
        .replace(/[^a-z0-9 ]/g, ' ')
        .split(/\s+/)
        .filter(w => w && w.length > 2)
    );
  }
  function jaccard(a, b) {
    if (!a.size || !b.size) return 0;
    let inter = 0;
    for (const x of a) if (b.has(x)) inter++;
    return inter / (a.size + b.size - inter);
  }
  function findRt1098CatalogTask(excelTitle, catalog) {
    const e = norm(excelTitle);
    if (!e) return null;
    for (const t of catalog) if (norm(t.task) === e) return t.id;
    const eToks = tokensOf(excelTitle);
    let best = null, bestScore = 0;
    for (const t of catalog) {
      const score = jaccard(eToks, tokensOf(t.task));
      if (score > bestScore) { best = t; bestScore = score; }
    }
    return bestScore >= 0.6 ? best.id : null;
  }

  // ---------------- JQS-CFETP ----------------
  function parseJqs(ws) {
    const progress = {};
    if (!ws) return progress;
    const rows = rowsFor(ws);
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const a = (r[0] || '').toString();
      // Item rows start with "N.N." or "N.N.N." then a space and the title.
      // Section rows look the same but lack the per-item columns we care about.
      const m = /^\s*(\d+(?:\.\d+)+)\.?\s+/.exec(a);
      if (!m) continue;
      const num = m[1];
      const start    = toISODate(r[3]);
      const complete = toISODate(r[4]);
      const traineeInitials   = (r[5] || '').toString().trim().toUpperCase();
      const trainerInitials   = (r[6] || '').toString().trim().toUpperCase();
      const certifierInitials = (r[7] || '').toString().trim().toUpperCase();
      if (!start && !complete && !traineeInitials && !trainerInitials && !certifierInitials) continue;
      const p = {};
      if (start)              p.start = start;
      if (complete)           p.complete = complete;
      if (traineeInitials)    p.traineeInitials = traineeInitials;
      if (trainerInitials)    p.trainerInitials = trainerInitials;
      if (certifierInitials)  p.certifierInitials = certifierInitials;
      progress[num] = p;
    }
    return progress;
  }

  // ---------------- Formal Training ----------------
  // Sections detected by marker rows; HAF entries before any marker.
  function parseFormal(ws) {
    const out = { haf: [], initial: [], continuation: [] };
    if (!ws) return out;
    const rows = rowsFor(ws);
    let section = 'haf', sawHeader = false;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const a = (r[0] || '').toString().trim();
      if (!a) continue;
      if (/^\*+\s*Initial Training\s*\*+/i.test(a))                { section = 'initial'; continue; }
      if (/^\*+\s*Optional Continuation Training\s*\*+/i.test(a))  { section = 'continuation'; continue; }
      if (/^Course Title$/i.test(a))                               { sawHeader = true; continue; }
      if (/^Formal Training\s*$/i.test(a))                         continue;
      if (/^Document all individuals/i.test(a))                    continue;
      if (/^NOTE:/i.test(a))                                       continue;
      if (!sawHeader) continue;
      out[section].push({ title: a, startDate: toISODate(r[1]), completeDate: toISODate(r[2]) });
    }
    return out;
  }

  // ---------------- main entry ----------------
  async function importExcel(files, state) {
    if (typeof XLSX === 'undefined') throw new Error('XLSX library not loaded');
    const wbs = [];
    for (const f of files) {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      wbs.push({ name: f.name, wb });
    }

    const stats = { qtpsSet: 0, ynSet: 0, formalLinked: 0, formalAdded: 0, jqsItems: 0, daf623a: 0, daf797: 0, daf1098Linked: 0, daf1098Added: 0 };

    // Cover + Qualifications
    const qualsResult = parseQualificationsSheet(findSheet(wbs, 'Qualifications'));
    const member = getStore().emptyMember();
    Object.assign(member.cover, qualsResult.cover);

    for (const exQtp of qualsResult.qtps) {
      const htmlName = mapQtpToHtml(exQtp.name);
      if (!htmlName) continue;
      const tgt = member.qualifications.qtps.find(q => q.name === htmlName);
      if (tgt) { if (exQtp.completeDate) tgt.completeDate = exQtp.completeDate; stats.qtpsSet++; }
    }
    for (const exYn of qualsResult.yesNo) {
      const htmlName = mapYnToHtml(exYn.name);
      if (!htmlName) continue;
      const tgt = member.qualifications.yesNo.find(y => y.name === htmlName);
      if (tgt) { tgt.value = exYn.value || 'No'; stats.ynSet++; }
    }

    // Formal Training (extends catalog if necessary)
    const formalData = parseFormal(findSheet(wbs, /^Formal Training$/i));
    const formalCatalogPatch = JSON.parse(JSON.stringify(state.formalCatalog || getStore().defaultFormalCatalog()));
    const formalProgress = {};
    for (const sec of ['haf','initial','continuation']) {
      for (const course of formalData[sec]) {
        // Try to find existing course in this section first, then any section
        let cat = formalCatalogPatch[sec].find(c => norm(c.course) === norm(course.title));
        if (!cat) {
          for (const otherSec of ['haf','initial','continuation']) {
            const found = formalCatalogPatch[otherSec].find(c => norm(c.course) === norm(course.title));
            if (found) { cat = found; break; }
          }
        }
        if (!cat) {
          cat = { id: getStore().uid('ft'), course: titleCase(course.title) };
          formalCatalogPatch[sec].push(cat);
          stats.formalAdded++;
        }
        if (course.startDate || course.completeDate) {
          formalProgress[cat.id] = {
            startDate: course.startDate || '',
            completeDate: course.completeDate || '',
          };
          stats.formalLinked++;
        }
      }
    }
    member.formalTrainingProgress = formalProgress;

    // JQS
    member.jqsProgress = parseJqs(findSheet(wbs, 'JQS-CFETP'));
    stats.jqsItems = Object.keys(member.jqsProgress).length;

    // 623A
    member.daf623a = parse623A(findSheet(wbs, '623A'));
    stats.daf623a = member.daf623a.length;

    // 797
    member.daf797 = parse797(findSheet(wbs, 'DAF Form 797'));
    stats.daf797 = member.daf797.length;

    // 1098 — two yearly sheets
    const rt1098Patch = JSON.parse(JSON.stringify(state.rt1098 || getStore().emptyRt1098()));
    const daf1098Progress = {};
    const yearSheets = [
      { year: '2025', sheet: findSheet(wbs, /^DAF Form 1098.*2025/i) },
      { year: '2026', sheet: findSheet(wbs, /^DAF Form 1098.*2026/i) },
    ];
    for (const { year, sheet } of yearSheets) {
      if (!sheet) continue;
      const items = parse1098(sheet);
      const yearProgress = {};
      for (const it of items) {
        let taskId = findRt1098CatalogTask(it.task, rt1098Patch.tasks);
        if (!taskId) {
          const newCat = { id: getStore().uid('rt'), task: titleCase(it.task), type: it.type || '', frequency: it.frequency || 'Annual' };
          if (it.scoreOrHours) newCat.scoreOrHours = it.scoreOrHours;
          rt1098Patch.tasks.push(newCat);
          taskId = newCat.id;
          stats.daf1098Added++;
        } else {
          // Fill in any missing catalog-level fields from the Excel
          const cat = rt1098Patch.tasks.find(t => t.id === taskId);
          if (cat) {
            if (!cat.type && it.type)             cat.type = it.type;
            if (!cat.frequency && it.frequency)   cat.frequency = it.frequency;
            if (!cat.scoreOrHours && it.scoreOrHours) cat.scoreOrHours = it.scoreOrHours;
          }
          stats.daf1098Linked++;
        }
        const p = {};
        if (it.startDate)       p.startDate       = it.startDate;
        if (it.completeDate)    p.lastCompleted   = it.completeDate;
        if (it.certInitials)    p.certifier       = it.certInitials;
        if (it.traineeInitials) p.traineeInitials = it.traineeInitials;
        // We intentionally do NOT import the Excel "Due Date" column — those values
        // were per-cycle deadlines that no longer make sense after import. Completed
        // items will show as "Complete" (no nextDue); incomplete items show blank.
        if (Object.keys(p).length) yearProgress[taskId] = p;
      }
      daf1098Progress[year] = yearProgress;
    }
    member.daf1098Progress = daf1098Progress;

    return { member, formalCatalogPatch, rt1098Patch, stats };
  }

  window.AMTRExcelImport = { importExcel };
})();
