export type PausableInspectionType = 'airfield' | 'lighting'

export function pauseKey(type: PausableInspectionType, installationId: string | null | undefined): string {
  return `glidepath_inspection_paused_${type}_${installationId ?? ''}`
}

export function isInspectionPaused(
  type: PausableInspectionType,
  installationId: string | null | undefined,
): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(pauseKey(type, installationId)) === 'true'
}

export function markInspectionPaused(
  type: PausableInspectionType,
  installationId: string | null | undefined,
): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(pauseKey(type, installationId), 'true')
}

/**
 * Returns true exactly once per pause: reads the flag, clears it if set, and reports
 * whether a resume activity should be logged. Callers should log only when this returns true.
 */
export function consumePauseFlag(
  type: PausableInspectionType,
  installationId: string | null | undefined,
): boolean {
  if (typeof window === 'undefined') return false
  const key = pauseKey(type, installationId)
  if (window.localStorage.getItem(key) !== 'true') return false
  window.localStorage.removeItem(key)
  return true
}
