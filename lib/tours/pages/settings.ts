import type { TourStep } from '@/components/tour/OnboardingTour'

export const SETTINGS_PAGE_TOUR: TourStep[] = [
  {
    id: 'settings-intro',
    anchor: 'settings-header',
    title: 'Settings',
    body:
      'Profile, theme, notifications, installation switcher (when ' +
      'you have base memberships at multiple bases), and the About ' +
      'screen with the current Glidepath version. Sign Out lives ' +
      'at the bottom of the sidebar, not here.',
  },
]
