// SLA Deadline Calculator (SRS Section 6.3)

const SLA_HOURS: Record<string, number> = {
  critical: 24,        // 24 hours
  high: 7 * 24,        // 7 days
  medium: 14 * 24,     // 14 days
  low: 30 * 24,        // 30 days
}

export function calculateSLADeadline(severity: string, createdAt: Date): Date {
  const hours = SLA_HOURS[severity] || 30 * 24
  return new Date(createdAt.getTime() + hours * 60 * 60 * 1000)
}

export function isOverdue(slaDeadline: Date | string | null, status: string): boolean {
  if (!slaDeadline) return false
  if (['resolved', 'closed'].includes(status)) return false
  return new Date() > new Date(slaDeadline)
}

export function slaTimeRemaining(slaDeadline: Date | string | null, status: string): string | null {
  if (!slaDeadline) return null
  if (['resolved', 'closed'].includes(status)) return null

  const now = new Date()
  const deadline = new Date(slaDeadline)
  const diffMs = deadline.getTime() - now.getTime()

  if (diffMs <= 0) {
    const overMs = Math.abs(diffMs)
    const overHr = Math.floor(overMs / (1000 * 60 * 60))
    const overDay = Math.floor(overHr / 24)
    if (overDay > 0) return `${overDay}d overdue`
    return `${overHr}h overdue`
  }

  const hrLeft = Math.floor(diffMs / (1000 * 60 * 60))
  const dayLeft = Math.floor(hrLeft / 24)
  if (dayLeft > 0) return `${dayLeft}d remaining`
  return `${hrLeft}h remaining`
}
