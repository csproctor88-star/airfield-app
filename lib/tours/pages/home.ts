import type { TourStep } from '@/components/tour/OnboardingTour'

export const HOME_PAGE_TOUR: TourStep[] = [
  {
    id: 'home-intro',
    anchor: 'home-header',
    title: 'Airfield Status',
    body:
      'Your default landing page. Real-time runway / NAVAID / ARFF / ' +
      'custom-board status; flip toggles as conditions change and the ' +
      'system writes a status-change log entry, optionally auto-' +
      'creating discrepancies on red NAVAIDs.',
  },
]
