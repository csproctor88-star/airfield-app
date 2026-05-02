import type { TourStep } from '@/components/tour/OnboardingTour'

export const DAILY_REVIEWS_PAGE_TOUR: TourStep[] = [
  {
    id: 'daily-reviews-intro',
    anchor: 'daily-reviews-header',
    title: 'Daily Reviews',
    body:
      'DAFMAN 13-204v1 §2.5.2.10.3 / .10.4 shift turnover + daily ' +
      'review queue. Each shift signs off on the events from their ' +
      'shift; AFM closes the day. The pending / reviewed counters in ' +
      'the header give you an at-a-glance read before scrolling.',
  },
  {
    id: 'daily-reviews-list',
    anchor: 'daily-reviews-list',
    title: 'Day rows',
    body:
      'One row per day in the visible window. The colored left rail ' +
      'communicates state at a glance: green when fully certified, ' +
      'amber when today is pending (your turn), quiet when a past day ' +
      'is still pending. Click any row to open the sign modal.',
  },
  {
    id: 'daily-reviews-slots',
    anchor: 'daily-reviews-list',
    title: 'Per-shift slots',
    body:
      'Each row shows the required sign-off slots for your base — ' +
      'Day AMSL, Swing AMSL, Mid AMSL (or just Day/Swing if your base ' +
      'runs a 2-shift schedule), then NAMO and AFM. The number of AMSL ' +
      'slots comes from bases.shift_count (2 or 3) configured in Base ' +
      'Setup.',
  },
  {
    id: 'daily-reviews-hash',
    anchor: 'daily-reviews-list',
    title: 'Events hash freezes the rollup',
    body:
      'When you sign a slot, the system records a SHA-256 hash of the ' +
      'sorted entity IDs in that day\'s Daily Ops rollup. If anything ' +
      'changes after certification, the Events Log row gets an AMENDED ' +
      'pill — the audit trail captures both the original certification ' +
      'and what changed underneath it.',
  },
  {
    id: 'daily-reviews-cert',
    anchor: 'daily-reviews-list',
    title: 'Daily certification',
    body:
      'Once every required slot is signed, fully_certified_at stamps ' +
      'and the row turns green. AFM signs last to close the day. The ' +
      'sign modal carries each signer\'s name + rank + Zulu timestamp ' +
      'plus any notes; the PDF export is your AFMAN evidence package.',
  },
]
