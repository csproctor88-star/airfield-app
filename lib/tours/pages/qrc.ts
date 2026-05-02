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
      'Available is the library you start a QRC from. Active is what ' +
      'is currently running and persists across shifts. History is ' +
      'the audit trail of every QRC closed at this base.',
  },
  {
    id: 'qrc-list',
    anchor: 'qrc-list',
    title: 'The QRC library',
    body:
      'Tiles are the active templates configured for this base. ' +
      'Click any tile to start that checklist — each step captures ' +
      'who acknowledged what and when, so the after-action review ' +
      'writes itself.',
  },
]
