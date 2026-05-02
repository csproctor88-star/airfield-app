import type { TourStep } from '@/components/tour/OnboardingTour'

export const INFRASTRUCTURE_PAGE_TOUR: TourStep[] = [
  {
    id: 'infrastructure-intro',
    anchor: 'infrastructure-header',
    title: 'Visual NAVAIDs',
    body:
      'Map view of every NAVAID component on the field — edge lights, ' +
      'PAPI, MALSR, ALSF, threshold bars, taxiway lighting. Click any ' +
      'fixture to log inop status; the Outage Engine classifies into ' +
      '4 tiers per DAFMAN A3.1 and detects bar-out conditions.',
  },
]
