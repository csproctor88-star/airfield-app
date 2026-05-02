import type { TourStep } from '@/components/tour/OnboardingTour'

// Lifted verbatim from the original inline TOUR_STEPS in
// components/base-setup/OnboardingTour.tsx so the wizard's tour copy is
// unchanged across the engine refactor.

export const SETUP_WIZARD_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Base Setup',
    body:
      'This wizard configures everything Glidepath needs to fit your installation. ' +
      'It takes about 30–60 minutes the first time. You can pause and resume at any step ' +
      '— your work auto-saves.',
  },
  {
    id: 'stepper',
    anchor: 'stepper-rail',
    title: 'Labeled stepper',
    body:
      'Each pill is one configuration area. Click any pill to jump to that step, ' +
      'or use the Next button at the bottom to move through in order.',
  },
  {
    id: 'guide',
    anchor: 'guide-panel',
    title: 'Per-step Guide',
    body:
      'The Guide panel on the right of every step explains what it does, why it matters, ' +
      'and the DAFMAN paragraph it satisfies. Open it any time you are unsure what to enter.',
  },
  {
    id: 'fieldhint',
    title: '(?) Field hints',
    body:
      'Inside each step, look for the (?) icon next to field labels. Hover or click it for ' +
      'a concrete example of what goes there.',
  },
  {
    id: 'autosave',
    anchor: 'autosave-pill',
    title: 'Auto-save indicator',
    body:
      'Your edits save automatically. The pill in the bottom-left confirms the last save ' +
      'and warns you if something fails to persist.',
  },
  {
    id: 'quicksetup',
    anchor: 'quick-setup-button',
    title: 'Quick Setup',
    body:
      'For typical configurations, Quick Setup pre-fills defaults from ICAO data and DAFMAN ' +
      'templates across 5 of the 16 steps. You will review every pre-filled step before it ' +
      'commits — nothing writes to your live tables without your explicit confirmation.',
  },
]
