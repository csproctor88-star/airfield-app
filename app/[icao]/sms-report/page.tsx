'use client'

import { useParams } from 'next/navigation'
import { PublicSafetyReportForm } from '@/components/sms/public-safety-report-form'

/**
 * Public safety-report form route. Anonymous, no auth required.
 * Mirrors /[icao]/ppr-request: resolves the base by ICAO via the
 * SECURITY DEFINER `get_public_safety_report_config_by_icao` RPC
 * and submits through `submit_safety_report_public`.
 */
export default function IcaoSmsReportPage() {
  const { icao } = useParams<{ icao: string }>()
  return <PublicSafetyReportForm icao={icao} />
}
