import type { TourStep } from '@/components/tour/OnboardingTour'

export const SHIFT_CHECKLIST_PAGE_TOUR: TourStep[] = [
  {
    id: 'shift-checklist-intro',
    anchor: 'shift-checklist-header',
    title: 'Shift Checklist',
    body:
      'Per-shift task list, grouped by your base’s configured shifts ' +
      '(1–3, renameable). Three-state toggle per task (not done / ' +
      'in progress / complete). Resets daily at the base’s reset time ' +
      '(0600L default). Shifts and items configured in Base ' +
      'Setup → Shift Checklist.',
  },
]
