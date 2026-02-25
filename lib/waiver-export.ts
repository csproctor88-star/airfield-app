import type { WaiverRow, WaiverCriteriaRow, WaiverReviewRow } from '@/lib/supabase/waivers'

type BaseInfo = { name: string; icao: string }

export async function generateWaiverExcel(
  waivers: WaiverRow[],
  criteria: WaiverCriteriaRow[],
  reviews: WaiverReviewRow[],
  baseInfo: BaseInfo
) {
  const XLSX = await import('xlsx')

  const wb = XLSX.utils.book_new()

  // Sheet 1: Waiver Register
  const registerData = waivers.map(w => ({
    'Waiver Number': w.waiver_number,
    'Classification': w.classification,
    'Status': w.status,
    'Hazard Rating': w.hazard_rating || '',
    'Description': w.description,
    'Criteria Impact': w.criteria_impact || '',
    'Corrective Action': w.corrective_action || '',
    'Proponent': w.proponent || '',
    'Project Number': w.project_number || '',
    'Program FY': w.program_fy || '',
    'Estimated Cost': w.estimated_cost || '',
    'Project Status': w.project_status || '',
    'Period Valid': w.period_valid || '',
    'Date Submitted': w.date_submitted || '',
    'Date Approved': w.date_approved || '',
    'Expiration Date': w.expiration_date || '',
    'Last Reviewed': w.last_reviewed_date || '',
    'Next Review Due': w.next_review_due || '',
    'Location': w.location_description || '',
    'FAA Case #': w.faa_case_number || '',
  }))

  const ws1 = XLSX.utils.json_to_sheet(registerData)
  // Set column widths
  ws1['!cols'] = [
    { wch: 18 }, { wch: 14 }, { wch: 10 }, { wch: 14 },
    { wch: 50 }, { wch: 25 }, { wch: 30 }, { wch: 16 },
    { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 20 },
    { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 18 },
  ]
  XLSX.utils.book_append_sheet(wb, ws1, 'Waiver Register')

  // Sheet 2: Annual Review
  const reviewYears = Array.from(new Set(reviews.map(r => r.review_year))).sort()
  if (reviewYears.length > 0) {
    const reviewData = waivers.map(w => {
      const row: Record<string, unknown> = {
        'Waiver Number': w.waiver_number,
        'Classification': w.classification,
        'Description': w.description.slice(0, 80),
      }
      for (const yr of reviewYears) {
        const rev = reviews.find(r => r.waiver_id === w.id && r.review_year === yr)
        row[`${yr} Reviewed`] = rev ? 'Yes' : ''
        row[`${yr} Recommendation`] = rev?.recommendation || ''
      }
      return row
    })
    const ws2 = XLSX.utils.json_to_sheet(reviewData)
    XLSX.utils.book_append_sheet(wb, ws2, 'Annual Review')
  }

  // Sheet 3: Coordination Status (placeholder — data from coordination table)
  const coordData = waivers.map(w => ({
    'Waiver Number': w.waiver_number,
    'Classification': w.classification,
    'Status': w.status,
    'Description': w.description.slice(0, 60),
  }))
  const ws3 = XLSX.utils.json_to_sheet(coordData)
  XLSX.utils.book_append_sheet(wb, ws3, 'Coordination Status')

  // Download
  const filename = `${baseInfo.icao}_Waiver_Register_${new Date().toISOString().split('T')[0]}.xlsx`
  XLSX.writeFile(wb, filename)
}

export async function generateAnnualReviewExcel(
  waivers: WaiverRow[],
  reviews: WaiverReviewRow[],
  year: number,
  baseInfo: BaseInfo
) {
  const XLSX = await import('xlsx')

  const wb = XLSX.utils.book_new()

  const data = waivers.map(w => {
    const rev = reviews.find(r => r.waiver_id === w.id && r.review_year === year)
    return {
      'Waiver Number': w.waiver_number,
      'Classification': w.classification,
      'Hazard Rating': w.hazard_rating || '',
      'Description': w.description,
      'Date Approved': w.date_approved || '',
      'Period Valid': w.period_valid || '',
      'Reviewed': rev ? 'Yes' : 'No',
      'Review Date': rev?.review_date || '',
      'Recommendation': rev?.recommendation || '',
      'Mitigation Verified': rev?.mitigation_verified ? 'Yes' : '',
      'Project Status Update': rev?.project_status_update || '',
      'Notes': rev?.notes || '',
      'Board Briefed': rev?.presented_to_facilities_board ? 'Yes' : '',
      'Board Date': rev?.facilities_board_date || '',
      'Corrective Action': w.corrective_action || '',
      'Project Status': w.project_status || '',
    }
  })

  const ws = XLSX.utils.json_to_sheet(data)
  ws['!cols'] = [
    { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 50 },
    { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 14 },
    { wch: 16 }, { wch: 16 }, { wch: 25 }, { wch: 30 },
    { wch: 12 }, { wch: 14 }, { wch: 30 }, { wch: 20 },
  ]
  XLSX.utils.book_append_sheet(wb, ws, `${year} Annual Review`)

  const filename = `${baseInfo.icao}_Annual_Review_${year}.xlsx`
  XLSX.writeFile(wb, filename)
}
