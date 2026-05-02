import type { TourStep } from '@/components/tour/OnboardingTour'

export const LIBRARY_PAGE_TOUR: TourStep[] = [
  {
    id: 'library-intro',
    anchor: 'library-header',
    title: 'PDF Library',
    body:
      'sys_admin-only archive of every PDF Glidepath has generated ' +
      'or stored — historical reports, signed waivers, archived ' +
      'inspections. Searchable by name and by month. Use sparingly; ' +
      'normal users go through Reports & Analytics for live data.',
  },
]
