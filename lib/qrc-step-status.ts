import type { QrcStepResponse } from '@/lib/supabase/types'

export type QrcStepStatus = 'completed' | 'not_applicable' | undefined

export function getStepStatus(resp: QrcStepResponse | undefined): QrcStepStatus {
  if (!resp) return undefined
  if (resp.status) return resp.status
  return resp.completed ? 'completed' : undefined
}

export function getAgencyStatus(
  resp: QrcStepResponse | undefined,
  agency: string,
): QrcStepStatus {
  if (!resp) return undefined
  if (resp.agencies_na?.includes(agency)) return 'not_applicable'
  if (resp.agencies_checked?.includes(agency)) return 'completed'
  return undefined
}
