import type { TourStep } from '@/components/tour/OnboardingTour'

export const BASE_CONFIG_PAGE_TOUR: TourStep[] = [
  {
    id: 'base-config-intro',
    anchor: 'base-config-header',
    title: 'Base Configuration',
    body:
      'Hub for installation-level admin work — module enablement, ' +
      'wizard for first-time setup, airfield diagram upload, ' +
      'inspection / QRC templates. The wizard at /base-config/setup ' +
      'has its own onboarding tour you can replay any time from the ' +
      'Help button there.',
  },
]
