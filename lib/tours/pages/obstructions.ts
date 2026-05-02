import type { TourStep } from '@/components/tour/OnboardingTour'

export const OBSTRUCTIONS_PAGE_TOUR: TourStep[] = [
  {
    id: 'obstructions-intro',
    anchor: 'obstructions-header',
    title: 'Obstruction Evaluation',
    body:
      'UFC 3-260-01 Chapter 3 imaginary-surface analysis. Plot a ' +
      'candidate obstruction (crane, antenna, structure) and the ' +
      'engine computes whether it penetrates the primary, approach, ' +
      'transitional, or inner-horizontal surfaces — and by how many ' +
      'feet.',
  },
  {
    id: 'obstructions-map',
    anchor: 'obstructions-map',
    title: 'Survey-grade overlays',
    body:
      'The map renders FAA survey coordinates for every imaginary ' +
      'surface around your runways and taxiways. Satellite imagery may ' +
      'not perfectly align with the survey data — basemap ' +
      'georegistration variance is normal. All distance and surface ' +
      'calculations use published coordinates, not visual rendering.',
  },
  {
    id: 'obstructions-pick',
    anchor: 'obstructions-map',
    title: 'Pick a point',
    body:
      'Tap anywhere on the map (or click Use My Location for an in-' +
      'situ evaluation) to drop a point. The card below the map ' +
      'reports coordinates, distance from centerline, and the surface ' +
      'name + altitude at that point — the headline read for whether ' +
      'a proposed obstruction clears.',
  },
  {
    id: 'obstructions-multi',
    anchor: 'obstructions-map',
    title: 'Line and area obstructions',
    body:
      'For obstructions that span more than one point — power lines, ' +
      'crane swing arcs, building footprints — the multi-point mode ' +
      'evaluates every vertex against every imaginary surface and ' +
      'flags the worst penetration. The Required Actions section ' +
      'below numbers each step you owe FAA + base leadership.',
  },
  {
    id: 'obstructions-history',
    anchor: 'obstructions-header',
    title: 'Evaluation history',
    body:
      'The History button opens a log of every past evaluation — ' +
      'closed, ongoing, and waivered. Each row links back to the ' +
      'original map + point, so you can re-open a prior eval without ' +
      're-entering coordinates. Useful for a six-month review cycle ' +
      'on long-running construction projects.',
  },
]
