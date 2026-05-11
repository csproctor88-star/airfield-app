import type { TourStep } from '@/components/tour/OnboardingTour'

export const FEEDBACK_PAGE_TOUR: TourStep[] = [
  {
    id: 'feedback-intro',
    anchor: 'feedback-header',
    title: 'Customer Feedback',
    body:
      'Inbox for the public QR-code feedback form (configured in ' +
      'Base Setup → Customer Feedback Form). Review submissions, ' +
      'reply, and route to the right module owner. The QR code is ' +
      'designed for posting at base ops or transient parking.',
  },
]
