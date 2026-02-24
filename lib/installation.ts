// Legacy helper — superseded by useInstallation() context.
// Kept for backwards compatibility; no longer references hardcoded constants.

export function getInstallation(): { name: string; icao: string } {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('installation-config')
    if (saved) {
      try { return JSON.parse(saved) } catch { /* ignore */ }
    }
  }
  return { name: 'Airfield', icao: '' }
}

export function saveInstallation(name: string, icao: string): void {
  localStorage.setItem('installation-config', JSON.stringify({ name, icao }))
}
