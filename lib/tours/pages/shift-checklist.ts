import type { TourStep } from '@/components/tour/OnboardingTour'

export const SHIFT_CHECKLIST_PAGE_TOUR: TourStep[] = [
  {
    id: 'shift-checklist-intro',
    anchor: 'shift-checklist-header',
    title: 'Shift Checklist',
    body:
      'Per-shift task list (Day / Swing / Mid). Three-state toggle ' +
      'per task (not done / in progress / complete). Resets at ' +
      '0600L per the installation timezone. Items configured in Base ' +
      'Setup → Shift Checklist.',
  },
]
