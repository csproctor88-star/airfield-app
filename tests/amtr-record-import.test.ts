import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import {
  splitInit, looksLikeInitials, taskSimilarity, matchTaskFuzzy, parseAmtrRecordWorkbook,
} from '@/lib/amtr-record-import'

// ─── AMTR record-import guards ───
// Locks the three import bugs found against the real AFFSA training record:
//   1. 1098 task titles must fuzzy-match the catalog (titles drift).
//   2. 803 evaluation blocks are vertically merged — one block must import as
//      one row, not one per merged slave row.
//   3. 623A narrative remarks must NOT leak into the signature (initials)
//      blocks; only initials-shaped tokens are signatures.

describe('623A splitInit — narrative stays out of signature blocks', () => {
  it('treats a multi-sentence remark with an internal " - " as a pure comment', () => {
    // The exact shape that broke: AFFSA "Records Transcribed" narrative whose
    // "line items 6 - 28" dash used to be split, dumping the leading sentence
    // into trainer_initials and rendering it in the SignCell.
    const s = 'I certify the information contained in the records dated 01 Oct 2020 was transcribed to line items 6 - 28 with a light gray background.'
    const { init, comment } = splitInit(s)
    expect(init).toBe('')
    expect(comment).toBe(s)
  })

  it('keeps narrative without any separator as a comment', () => {
    const s = 'Member Started Lessons 26, 2, 6, 7, and 8. Member has completed Lessons 1, 3 and 7.'
    expect(splitInit(s)).toEqual({ init: '', comment: s })
  })

  it('nulls AFFSA empty-slot placeholders ("None"/"N/A")', () => {
    expect(splitInit('None')).toEqual({ init: '', comment: '' })
    expect(splitInit('NONE')).toEqual({ init: '', comment: '' })
    expect(splitInit('N/A')).toEqual({ init: '', comment: '' })
    expect(splitInit('--')).toEqual({ init: '', comment: '' })
  })

  it('reads a bare initials token as a signature', () => {
    expect(splitInit('TS')).toEqual({ init: 'TS', comment: '' })
    expect(splitInit('T.S.')).toEqual({ init: 'T.S.', comment: '' })
  })

  it('round-trips the app export format "<comment> / <INITIALS>"', () => {
    expect(splitInit('Completed annual review / TS')).toEqual({ init: 'TS', comment: 'Completed annual review' })
  })

  it('round-trips the legacy export format "<INITIALS> — <comment>" only for short leading tokens', () => {
    expect(splitInit('TS — reviewed and approved')).toEqual({ init: 'TS', comment: 'reviewed and approved' })
    // A long leading segment is narrative, not initials — must stay a comment.
    const narrative = 'Trainee completed the module and was signed off - see attached.'
    expect(splitInit(narrative)).toEqual({ init: '', comment: narrative })
  })

  it('looksLikeInitials rejects prose and accepts initials', () => {
    expect(looksLikeInitials('TS')).toBe(true)
    expect(looksLikeInitials('J.A.S.')).toBe(true)
    expect(looksLikeInitials('Member started')).toBe(false)
    expect(looksLikeInitials('Records Transcribed')).toBe(false)
  })
})

describe('1098 fuzzy task matching', () => {
  it('scores normalized-identical titles as 1', () => {
    expect(taskSimilarity('SNOW AND ICE CONTROL', 'Snow and Ice Control')).toBe(1)
  })

  it('matches a catalog title that is a subset of the record title', () => {
    // Catalog "Bird/Wildlife Control" ⊂ record with trailing parenthetical.
    expect(taskSimilarity('BIRD/WILDLIFE CONTROL (ACTIVE/PASSIVE MEASURES)', 'Bird/Wildlife Control'))
      .toBeGreaterThanOrEqual(0.85)
  })

  it('matches across a reg/owner prefix difference', () => {
    expect(taskSimilarity('HAF - EMERGENCY EVAC/ ALTERNATE FACILITY PROCEDURES', 'Emergency Evac/Alternate Facility Procedures'))
      .toBeGreaterThanOrEqual(0.8)
  })

  it('keeps clearly different tasks below the match threshold', () => {
    expect(taskSimilarity('AIRCRAFT CHARACTERISTICS / PERFORMANCE', 'SNOW AND ICE CONTROL')).toBeLessThan(0.6)
  })

  it('matchTaskFuzzy picks the right catalog row and rejects no-confidence titles', () => {
    const candidates = [
      { task: 'Bird/Wildlife Control', row: { id: 'wildlife' } },
      { task: 'Snow and Ice Control', row: { id: 'snow' } },
      { task: 'Generator Start-Up/Power Transfer', row: { id: 'gen' } },
    ]
    expect(matchTaskFuzzy('BIRD/WILDLIFE CONTROL (ACTIVE/PASSIVE MEASURES)', candidates)?.id).toBe('wildlife')
    expect(matchTaskFuzzy('SNOW & ICE CONTROL', candidates)?.id).toBe('snow')
    expect(matchTaskFuzzy('Completely Unrelated Task XYZ', candidates)).toBeUndefined()
  })
})

describe('803 import — vertical merge dedup', () => {
  // Build a synthetic 5-Level 803 sheet that mirrors the AFFSA layout: each
  // evaluation block's STS item + columns merge vertically across several
  // rows, blocks are separated by a "Remarks" row, and the header repeats.
  async function build803Workbook(): Promise<ArrayBuffer> {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('DAF Form 803 (5-Level)')
    // Header
    ws.getCell('A1').value = 'JQS Task Item(s) Evaluated'
    ws.getCell('K1').value = 'Date'; ws.getCell('L1').value = 'In UGT Yes or NO'
    ws.getCell('M1').value = 'Results Sat/Unsat'; ws.getCell('N1').value = 'Evaluator Signature'
    // Block 1 — one eval spanning rows 2-5 (4 merged rows)
    ws.getCell('A2').value = '7. Airfield Programs: 7.1. Airfield Inspections'
    ws.getCell('K2').value = '2026-02-04'; ws.getCell('L2').value = 'NO'
    ws.getCell('M2').value = 'SAT'; ws.getCell('N2').value = 'TS'
    ws.mergeCells('A2:J5'); ws.mergeCells('K2:K5'); ws.mergeCells('L2:L5'); ws.mergeCells('M2:M5'); ws.mergeCells('N2:N5')
    // Remarks separator
    ws.getCell('A6').value = 'Remarks'; ws.mergeCells('A6:N6')
    // Repeated header (must be skipped as boilerplate)
    ws.getCell('A7').value = 'JQS Task Item(s) Evaluated'
    ws.getCell('K7').value = 'Date'; ws.getCell('M7').value = 'Results Sat/Unsat'; ws.getCell('N7').value = 'Evaluator Signature'
    // Block 2 — one eval spanning rows 8-10 (3 merged rows)
    ws.getCell('A8').value = '12. Airfield Markings: 12.1. Runway Markings'
    ws.getCell('K8').value = '2026-03-01'; ws.getCell('L8').value = 'NO'
    ws.getCell('M8').value = 'SAT'; ws.getCell('N8').value = 'RS'
    ws.mergeCells('A8:J10'); ws.mergeCells('K8:K10'); ws.mergeCells('L8:L10'); ws.mergeCells('M8:M10'); ws.mergeCells('N8:N10')
    const buf = await wb.xlsx.writeBuffer()
    return buf as ArrayBuffer
  }

  it('imports one row per merged evaluation block (not one per slave row)', async () => {
    const parsed = await parseAmtrRecordWorkbook(await build803Workbook())
    const rows = parsed.items803.fiveLevel ?? []
    expect(rows.map((r) => r.sts_item)).toEqual([
      '7. Airfield Programs: 7.1. Airfield Inspections',
      '12. Airfield Markings: 12.1. Runway Markings',
    ])
    expect(rows[0]).toMatchObject({ eval_date: '2026-02-04', results: 'SAT', evaluator: 'TS' })
    expect(rows[1]).toMatchObject({ eval_date: '2026-03-01', results: 'SAT', evaluator: 'RS' })
  })
})
