// UFC 3-260-01 Obstruction Evaluation (SRS Section 6.5)
// [FULL] phase — stub with types for now

import { INSTALLATION } from '@/lib/constants'

export type ObstructionResult = {
  surface: string
  name: string
  maxAllowableHeight: number
  objectHeight: number
  violated: boolean
  penetrationDepth: number
  description: string
}

export const IMAGINARY_SURFACES = {
  primary: {
    name: 'Primary Surface',
    criteria: {
      A: { width: 2000, extension: 200, maxHeight: 0 },
      B: { width: 1500, extension: 200, maxHeight: 0 },
    },
    description: 'No objects permitted above runway elevation',
  },
  approach_departure: {
    name: 'Approach-Departure Clearance',
    criteria: {
      A: { slope: 50, innerWidth: 2000, outerWidth: 16000, length: 50000 },
      B: { slope: 50, innerWidth: 1500, outerWidth: 13250, length: 50000 },
    },
    description: '50:1 slope from end of primary surface',
  },
  inner_horizontal: {
    name: 'Inner Horizontal',
    criteria: {
      A: { height: 150, radius: 7500 },
      B: { height: 150, radius: 7500 },
    },
    description: '150 ft above established airfield elevation',
  },
  conical: {
    name: 'Conical',
    criteria: {
      A: { slope: 20, horizontalExtent: 7000, baseHeight: 150 },
      B: { slope: 20, horizontalExtent: 7000, baseHeight: 150 },
    },
    description: '20:1 slope outward from inner horizontal',
  },
  outer_horizontal: {
    name: 'Outer Horizontal',
    criteria: {
      A: { height: 500, radius: 30000 },
      B: { height: 500, radius: 30000 },
    },
    description: '500 ft above established airfield elevation',
  },
  transitional: {
    name: 'Transitional',
    criteria: {
      A: { slope: 7 },
      B: { slope: 7 },
    },
    description: '7:1 slope from primary/approach edges to inner horizontal',
  },
} as const

export function evaluateObstruction(
  heightAGL: number,
  distanceFromEdge: number,
  elevationMSL: number | null,
  runwayClass: 'A' | 'B'
): ObstructionResult[] {
  const airfieldElevation = INSTALLATION.elevation_msl
  const objectTopMSL = elevationMSL
    ? elevationMSL + heightAGL
    : airfieldElevation + heightAGL
  const heightAboveField = objectTopMSL - airfieldElevation

  const results: ObstructionResult[] = []

  // Primary Surface
  const primary = IMAGINARY_SURFACES.primary.criteria[runwayClass]
  const primaryMax = primary.maxHeight
  results.push({
    surface: 'primary',
    name: IMAGINARY_SURFACES.primary.name,
    maxAllowableHeight: primaryMax,
    objectHeight: heightAboveField,
    violated: heightAboveField > primaryMax && distanceFromEdge <= primary.width / 2,
    penetrationDepth: Math.max(0, heightAboveField - primaryMax),
    description: IMAGINARY_SURFACES.primary.description,
  })

  // Approach-Departure
  const approach = IMAGINARY_SURFACES.approach_departure.criteria[runwayClass]
  const approachMax = distanceFromEdge / approach.slope
  results.push({
    surface: 'approach_departure',
    name: IMAGINARY_SURFACES.approach_departure.name,
    maxAllowableHeight: approachMax,
    objectHeight: heightAboveField,
    violated: heightAboveField > approachMax && distanceFromEdge <= approach.length,
    penetrationDepth: Math.max(0, heightAboveField - approachMax),
    description: IMAGINARY_SURFACES.approach_departure.description,
  })

  // Inner Horizontal
  const innerH = IMAGINARY_SURFACES.inner_horizontal.criteria[runwayClass]
  results.push({
    surface: 'inner_horizontal',
    name: IMAGINARY_SURFACES.inner_horizontal.name,
    maxAllowableHeight: innerH.height,
    objectHeight: heightAboveField,
    violated: heightAboveField > innerH.height && distanceFromEdge <= innerH.radius,
    penetrationDepth: Math.max(0, heightAboveField - innerH.height),
    description: IMAGINARY_SURFACES.inner_horizontal.description,
  })

  // Conical
  const conical = IMAGINARY_SURFACES.conical.criteria[runwayClass]
  const distFromInnerH = Math.max(0, distanceFromEdge - innerH.radius)
  const conicalMax = conical.baseHeight + distFromInnerH / conical.slope
  results.push({
    surface: 'conical',
    name: IMAGINARY_SURFACES.conical.name,
    maxAllowableHeight: conicalMax,
    objectHeight: heightAboveField,
    violated: heightAboveField > conicalMax && distFromInnerH <= conical.horizontalExtent,
    penetrationDepth: Math.max(0, heightAboveField - conicalMax),
    description: IMAGINARY_SURFACES.conical.description,
  })

  // Outer Horizontal
  const outerH = IMAGINARY_SURFACES.outer_horizontal.criteria[runwayClass]
  results.push({
    surface: 'outer_horizontal',
    name: IMAGINARY_SURFACES.outer_horizontal.name,
    maxAllowableHeight: outerH.height,
    objectHeight: heightAboveField,
    violated: heightAboveField > outerH.height && distanceFromEdge <= outerH.radius,
    penetrationDepth: Math.max(0, heightAboveField - outerH.height),
    description: IMAGINARY_SURFACES.outer_horizontal.description,
  })

  // Transitional
  const transitional = IMAGINARY_SURFACES.transitional.criteria[runwayClass]
  const transitionalMax = distanceFromEdge / transitional.slope
  results.push({
    surface: 'transitional',
    name: IMAGINARY_SURFACES.transitional.name,
    maxAllowableHeight: transitionalMax,
    objectHeight: heightAboveField,
    violated: heightAboveField > transitionalMax,
    penetrationDepth: Math.max(0, heightAboveField - transitionalMax),
    description: IMAGINARY_SURFACES.transitional.description,
  })

  return results
}
