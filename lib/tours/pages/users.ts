import type { TourStep } from '@/components/tour/OnboardingTour'

export const USERS_PAGE_TOUR: TourStep[] = [
  {
    id: 'users-intro',
    anchor: 'users-header',
    title: 'User Management',
    body:
      'Invite, edit, and remove users; assign roles from the ' +
      'permission matrix; grant per-user permission overrides for ' +
      'the rare case a member needs more or less than their role ' +
      'preset gives them.',
  },
]
