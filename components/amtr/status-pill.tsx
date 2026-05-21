'use client'

import { Badge } from '@/components/ui/badge'
import type { DueStatus, StatusTone } from '@/lib/amtr/status'

const TONE_COLOR: Record<StatusTone, string> = {
  ok: 'var(--color-success)',
  warn: 'var(--color-warning)',
  bad: 'var(--color-danger)',
  neutral: '#94A3B8',
}

const STATUS_LABEL: Record<DueStatus, string> = {
  complete: 'Complete',
  due_soon: 'Due Soon',
  overdue: 'Overdue',
  upcoming: 'Upcoming',
}

const STATUS_TONE: Record<DueStatus, StatusTone> = {
  complete: 'ok',
  due_soon: 'warn',
  overdue: 'bad',
  upcoming: 'neutral',
}

export function StatusPill({ status }: { status: DueStatus }) {
  return <Badge label={STATUS_LABEL[status]} color={TONE_COLOR[STATUS_TONE[status]]} />
}

export function tonedColor(tone: StatusTone): string {
  return TONE_COLOR[tone]
}
