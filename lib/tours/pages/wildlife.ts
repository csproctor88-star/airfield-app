import type { TourStep } from '@/components/tour/OnboardingTour'

export const WILDLIFE_PAGE_TOUR: TourStep[] = [
  {
    id: 'wildlife-intro',
    anchor: 'wildlife-header',
    title: 'Wildlife / BASH',
    body:
      'Bird and wildlife Aircraft Strike Hazard module — log every ' +
      'sighting and every strike, track dispersal effectiveness, and ' +
      'build the trend data your annual mitigation review depends on. ' +
      'Species list is curated to your base in Base Setup → Wildlife ' +
      'Species.',
  },
  {
    id: 'wildlife-actions',
    anchor: 'wildlife-actions',
    title: 'Sighting vs Strike',
    body:
      '+ Sighting (green) for observed wildlife with optional dispersal ' +
      'action and effectiveness; + Strike (red) for confirmed aircraft ' +
      'contact with damage level and aircraft details. Two different ' +
      'forms because they feed two different reporting requirements.',
  },
  {
    id: 'wildlife-tabs',
    anchor: 'wildlife-tabs',
    title: 'Four views',
    body:
      'Activity Log is the day-grouped timeline. Heatmap aggregates ' +
      'sighting + strike density on the airfield map. Analytics shows ' +
      'species trends, dispersal effectiveness, and time-of-day ' +
      'patterns. Reports generates the wildlife strike summary PDF.',
  },
  {
    id: 'wildlife-filters',
    anchor: 'wildlife-filters',
    title: 'Filter the timeline',
    body:
      'Narrow by entry type (sightings, strikes, or both) and by date ' +
      'range — last 7 days through last 12 months. The summary footer ' +
      'below the timeline reflects the active filter.',
  },
  {
    id: 'wildlife-list',
    anchor: 'wildlife-list',
    title: 'Day-grouped timeline',
    body:
      'Entries cluster under Today / Yesterday / weekday-date headers. ' +
      'Each row leads with the species and count, then the SIGHTING / ' +
      'STRIKE pill, the dispersal action taken (if any), and the ' +
      'damage level (for strikes). Edit and delete inline.',
  },
  {
    id: 'wildlife-heatmap',
    anchor: 'wildlife-tabs',
    title: 'Heatmap + analytics',
    body:
      'Switch to Heatmap to see strike density on the airfield — the ' +
      'one Mapbox holdout in the app, kept because heatmap rendering ' +
      'across base layers is cleaner there. Analytics shows monthly ' +
      'volume, top species, dispersal success rate, and damage ' +
      'distribution.',
  },
]
