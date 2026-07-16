import type { TourStep } from '@/components/tour/OnboardingTour'

export type TourScope = 'app' | 'wizard' | 'page'

export type TourRegistration = {
  tourId: string
  label: string                                  // shown in the Help dropdown
  scope: TourScope
  steps: TourStep[]
  visibleWhen?: (pathname: string) => boolean    // gate the Help-menu entry to a specific route
}

const REGISTRY: TourRegistration[] = []

export function registerTour(entry: TourRegistration): void {
  const existing = REGISTRY.findIndex(t => t.tourId === entry.tourId)
  if (existing >= 0) {
    REGISTRY[existing] = entry
  } else {
    REGISTRY.push(entry)
  }
}

export function getTour(tourId: string): TourRegistration | null {
  return REGISTRY.find(t => t.tourId === tourId) ?? null
}
