import type { WaiverRow, WaiverCriteriaRow, WaiverReviewRow } from '@/lib/supabase/waivers'
import { createStyledWorkbook, addStyledSheet, saveWorkbook, titleCase, type ColumnDef } from '@/lib/excel-export'

type BaseInfo = { name: string; icao: string }

export async function generateWaiverExcel(
  waivers: WaiverRow[],
  criteria: WaiverCriteriaRow[],
  reviews: WaiverReviewRow[],
  baseInfo: BaseInfo
) {
  const wb = await createStyledWorkbook()

  // Sheet 1: Waiver Register
  const registerCols: ColumnDef[] = [
    { header: 'Waiver Number', key: 'waiver_number', width: 18 },
    { header: 'Classification', key: 'classification', width: 14 },
    { header: 'Status', key: 'status', width: 10 },
    { header: 'Hazard Rating', key: 'hazard_rating', width: 14 },
    { header: 'Description', key: 'description', width: 50 },
    { header: 'Criteria Impact', key: 'criteria_impact', width: 25 },
    { header: 'Corrective Action', key: 'corrective_action', width: 30 },
    { header: 'Proponent', key: 'proponent', width: 16 },
    { header: 'Project Number', key: 'project_number', width: 14 },
    { header: 'Program FY', key: 'program_fy', width: 10 },
    { header: 'Estimated Cost', key: 'estimated_cost', width: 14 },
    { header: 'Project Status', key: 'project_status', width: 20 },
    { header: 'Period Valid', key: 'period_valid', width: 16 },
    { header: 'Date Submitted', key: 'date_submitted', width: 14 },
    { header: 'Date Approved', key: 'date_approved', width: 14 },
    { header: 'Expiration Date', key: 'expiration_date', width: 14 },
    { header: 'Last Reviewed', key: 'last_reviewed', width: 14 },
    { header: 'Next Review Due', key: 'next_review_due', width: 14 },
    { header: 'Location', key: 'location', width: 20 },
    { header: 'FAA Case #', key: 'faa_case', width: 18 },
  ]

  const registerRows = waivers.map(w => ({
    waiver_number: w.waiver_number,
    classification: titleCase(w.classification),
    status: titleCase(w.status),
    hazard_rating: w.hazard_rating || '',
    description: w.description,
    criteria_impact: w.criteria_impact || '',
    corrective_action: w.corrective_action || '',
    proponent: w.proponent || '',
    project_number: w.project_number || '',
    program_fy: w.program_fy || '',
    estimated_cost: w.estimated_cost || '',
    project_status: w.project_status || '',
    period_valid: w.period_valid || '',
    date_submitted: w.date_submitted || '',
    date_approved: w.date_approved || '',
    expiration_date: w.expiration_date || '',
    last_reviewed: w.last_reviewed_date || '',
    next_review_due: w.next_review_due || '',
    location: w.location_description || '',
    faa_case: w.faa_case_number || '',
  }))

  addStyledSheet(wb, 'Waiver Register', registerCols, registerRows)

  // Sheet 2: Criteria & Standards
  if (criteria.length > 0) {
    const critCols: ColumnDef[] = [
      { header: 'Waiver Number', key: 'waiver_number', width: 18 },
      { header: 'Criteria Source', key: 'criteria_source', width: 18 },
      { header: 'Reference', key: 'reference', width: 25 },
      { header: 'Description', key: 'description', width: 60 },
    ]
    const critRows = criteria.map(c => {
      const waiver = waivers.find(w => w.id === c.waiver_id)
      return {
        waiver_number: waiver?.waiver_number || '',
        criteria_source: (c.criteria_source || '').replace(/_/g, ' ').toUpperCase(),
        reference: c.reference || '',
        description: c.description || '',
      }
    })
    addStyledSheet(wb, 'Criteria & Standards', critCols, critRows)
  }

  // Sheet 3: Annual Review
  const reviewYears = Array.from(new Set(reviews.map(r => r.review_year))).sort()
  if (reviewYears.length > 0) {
    const reviewCols: ColumnDef[] = [
      { header: 'Waiver Number', key: 'waiver_number', width: 18 },
      { header: 'Classification', key: 'classification', width: 14 },
      { header: 'Description', key: 'description', width: 50 },
    ]
    for (const yr of reviewYears) {
      reviewCols.push({ header: `${yr} Reviewed`, key: `${yr}_reviewed`, width: 12 })
      reviewCols.push({ header: `${yr} Recommendation`, key: `${yr}_recommendation`, width: 20 })
    }
    const reviewRows = waivers.map(w => {
      const row: Record<string, unknown> = {
        waiver_number: w.waiver_number,
        classification: titleCase(w.classification),
        description: w.description.slice(0, 80),
      }
      for (const yr of reviewYears) {
        const rev = reviews.find(r => r.waiver_id === w.id && r.review_year === yr)
        row[`${yr}_reviewed`] = rev ? 'Yes' : ''
        row[`${yr}_recommendation`] = rev?.recommendation || ''
      }
      return row
    })
    addStyledSheet(wb, 'Annual Review', reviewCols, reviewRows)
  }

  // Sheet 4: Coordination Status
  const coordCols: ColumnDef[] = [
    { header: 'Waiver Number', key: 'waiver_number', width: 18 },
    { header: 'Classification', key: 'classification', width: 14 },
    { header: 'Status', key: 'status', width: 10 },
    { header: 'Description', key: 'description', width: 60 },
  ]
  const coordRows = waivers.map(w => ({
    waiver_number: w.waiver_number,
    classification: titleCase(w.classification),
    status: titleCase(w.status),
    description: w.description.slice(0, 60),
  }))
  addStyledSheet(wb, 'Coordination Status', coordCols, coordRows)

  // Download
  const filename = `${baseInfo.icao}_Waiver_Register_${new Date().toISOString().split('T')[0]}.xlsx`
  await saveWorkbook(wb, filename)
}

export async function generateAnnualReviewExcel(
  waivers: WaiverRow[],
  reviews: WaiverReviewRow[],
  year: number,
  baseInfo: BaseInfo
) {
  const wb = await createStyledWorkbook()

  const columns: ColumnDef[] = [
    { header: 'Waiver Number', key: 'waiver_number', width: 18 },
    { header: 'Classification', key: 'classification', width: 14 },
    { header: 'Hazard Rating', key: 'hazard_rating', width: 14 },
    { header: 'Description', key: 'description', width: 50 },
    { header: 'Date Approved', key: 'date_approved', width: 14 },
    { header: 'Period Valid', key: 'period_valid', width: 16 },
    { header: 'Reviewed', key: 'reviewed', width: 10 },
    { header: 'Review Date', key: 'review_date', width: 14 },
    { header: 'Recommendation', key: 'recommendation', width: 16 },
    { header: 'Mitigation Verified', key: 'mitigation_verified', width: 16 },
    { header: 'Project Status Update', key: 'project_status_update', width: 25 },
    { header: 'Notes', key: 'notes', width: 30 },
    { header: 'Board Briefed', key: 'board_briefed', width: 12 },
    { header: 'Board Date', key: 'board_date', width: 14 },
    { header: 'Corrective Action', key: 'corrective_action', width: 30 },
    { header: 'Project Status', key: 'project_status', width: 20 },
  ]

  const rows = waivers.map(w => {
    const rev = reviews.find(r => r.waiver_id === w.id && r.review_year === year)
    return {
      waiver_number: w.waiver_number,
      classification: titleCase(w.classification),
      hazard_rating: w.hazard_rating || '',
      description: w.description,
      date_approved: w.date_approved || '',
      period_valid: w.period_valid || '',
      reviewed: rev ? 'Yes' : 'No',
      review_date: rev?.review_date || '',
      recommendation: rev?.recommendation || '',
      mitigation_verified: rev?.mitigation_verified ? 'Yes' : '',
      project_status_update: rev?.project_status_update || '',
      notes: rev?.notes || '',
      board_briefed: rev?.presented_to_facilities_board ? 'Yes' : '',
      board_date: rev?.facilities_board_date || '',
      corrective_action: w.corrective_action || '',
      project_status: w.project_status || '',
    }
  })

  addStyledSheet(wb, `${year} Annual Review`, columns, rows)

  const filename = `${baseInfo.icao}_Annual_Review_${year}.xlsx`
  await saveWorkbook(wb, filename)
}
