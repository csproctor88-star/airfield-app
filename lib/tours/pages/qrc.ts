import type { TourStep } from '@/components/tour/OnboardingTour'

export const QRC_PAGE_TOUR: TourStep[] = [
  {
    id: 'qrc-intro',
    anchor: 'qrc-header',
    title: 'Quick Reaction Checklists',
    body:
      'Step-by-step emergency response checklists — aircraft mishap, ' +
      'hung ordnance, fuel spill, severe weather, and more. The red ' +
      'dot on the sidebar fires when one or more QRCs are active.',
  },
  {
    id: 'qrc-tabs',
    anchor: 'qrc-tabs',
    title: 'Three tabs',
    body:
      'Available is the library you start a QRC from. Active is the ' +
      'currently-running checklists — they persist across shifts so ' +
      'you can hand off mid-emergency. History is the audit trail of ' +
      'every QRC closed at this base.',
  },
  {
    id: 'qrc-list',
    anchor: 'qrc-list',
    title: 'The QRC library',
    body:
      'Tiles are the active templates configured for this base. The ' +
      'review pill on each tile flags whether the template is current ' +
      '(reviewed within the last year) or overdue — admin can update ' +
      'the review date from the execution view.',
  },
  {
    id: 'qrc-step-types',
    anchor: 'qrc-list',
    title: 'Eight step types',
    body:
      'When you start a QRC the engine walks you through steps of ' +
      'eight different kinds — confirmations, notifications, ' +
      'navigations to other modules (e.g. file an SCN), free-text ' +
      'capture, sub-checklists, status updates, and more. Each step ' +
      'records who acknowledged it and when.',
  },
  {
    id: 'qrc-aar',
    anchor: 'qrc-list',
    title: 'Audit trail + AAR PDF',
    body:
      'Closing a QRC stamps the closer + Zulu time and freezes the ' +
      'response record. Download the After-Action PDF straight from ' +
      'the execution view — every step with its acknowledgement ' +
      'metadata, ready for the post-event debrief.',
  },
]
