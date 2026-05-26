/**
 * Runway Condition Code (RwyCC) engine — AC 150/5200-30D
 *
 * Two pure functions plus the constant labels used by the UI:
 *
 *   deriveRwycc(input)           — Per Table 4-1 / §4.2 maps a single third's
 *                                   contaminant + depth + temperature to its
 *                                   RwyCC value (6 down to 0). Operator may
 *                                   override per AC 30D §4.2.
 *   buildFiconNotamText(input)   — Per §6, builds the FICON NOTAM body that
 *                                   operators paste into the FAA NOTAM Manager.
 *
 * Combined-contaminant edge cases (slush over compacted snow, etc.) aren't
 * explicitly encoded — the function handles the 13 single-contaminant cases
 * per Table 4-1 and the UI's operator-override path covers anything more
 * nuanced. The override requires a reason that's logged with the report.
 */

export type Contaminant =
  | 'dry'
  | 'wet'
  | 'frost'
  | 'slush'
  | 'dry_snow'
  | 'wet_snow'
  | 'compacted_snow'
  | 'ice'
  | 'ice_patches'
  | 'wet_ice'
  | 'slippery_when_wet'
  | 'water_on_compacted_snow'
  | 'slush_on_ice'

export type RwyccCode = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type Third = 'touchdown' | 'midpoint' | 'rollout'

export type Treatment =
  | 'none'
  | 'plowed'
  | 'swept'
  | 'broomed'
  | 'sanded'
  | 'chemically_treated'
  | 'de_iced'

// ────────────────────────────────────────────────────────────────
// Display labels (UI source of truth — never display raw enum keys)
// ────────────────────────────────────────────────────────────────

export const CONTAMINANT_LABELS: Record<Contaminant, string> = {
  dry:                     'Dry',
  wet:                     'Wet',
  frost:                   'Frost',
  slush:                   'Slush',
  dry_snow:                'Dry Snow',
  wet_snow:                'Wet Snow',
  compacted_snow:          'Compacted Snow',
  ice:                     'Ice',
  ice_patches:             'Ice Patches',
  wet_ice:                 'Wet Ice',
  slippery_when_wet:       'Slippery When Wet',
  water_on_compacted_snow: 'Water over Compacted Snow',
  slush_on_ice:            'Slush over Ice',
}

export const TREATMENT_LABELS: Record<Treatment, string> = {
  none:               'None',
  plowed:             'Plowed',
  swept:              'Swept',
  broomed:            'Broomed',
  sanded:             'Sanded',
  chemically_treated: 'Chemically Treated',
  de_iced:            'De-Iced',
}

export const THIRD_LABELS: Record<Third, string> = {
  touchdown: 'Touchdown',
  midpoint:  'Midpoint',
  rollout:   'Rollout',
}

/** Short tokens used in the FICON NOTAM body per AC 30D §6. */
export const CONTAMINANT_NOTAM_TOKENS: Record<Contaminant, string> = {
  dry:                     'DRY',
  wet:                     'WET',
  frost:                   'FROST',
  slush:                   'SLUSH',
  dry_snow:                'DRY SN',
  wet_snow:                'WET SN',
  compacted_snow:          'COMPACTED SN',
  ice:                     'ICE',
  ice_patches:             'ICE PATCHES',
  wet_ice:                 'WET ICE',
  slippery_when_wet:       'SLIP',
  water_on_compacted_snow: 'WATER OVER COMPACTED SN',
  slush_on_ice:            'SLUSH OVER ICE',
}

/** Treatment short tokens for the "TRTD W/" suffix in the FICON body. */
export const TREATMENT_NOTAM_TOKENS: Record<Treatment, string | null> = {
  none:               null,        // skip
  plowed:             'PLOW',
  swept:              'SWEPT',
  broomed:            'BROOM',
  sanded:             'SAND',
  chemically_treated: 'CHEM',
  de_iced:            'DEICED',
}

/** Ordered list of contaminants for UI dropdowns (best → worst). */
export const CONTAMINANT_ORDER: Contaminant[] = [
  'dry', 'wet', 'frost', 'slush', 'dry_snow', 'wet_snow', 'compacted_snow',
  'ice_patches', 'slippery_when_wet', 'ice', 'wet_ice',
  'water_on_compacted_snow', 'slush_on_ice',
]

export const TREATMENT_ORDER: Treatment[] = [
  'plowed', 'swept', 'broomed', 'sanded', 'chemically_treated', 'de_iced', 'none',
]

export const THIRD_ORDER: Third[] = ['touchdown', 'midpoint', 'rollout']

// ────────────────────────────────────────────────────────────────
// Core RwyCC derivation per AC 30D Table 4-1
// ────────────────────────────────────────────────────────────────

/**
 * Returns the RwyCC value (6=best dry, 0=nil — wet ice / slush on ice)
 * for a single runway third given contaminant + depth + ambient temperature.
 *
 * Operator override is supported at the data layer (see field_condition_thirds
 * .rwycc + .rwycc_manual_override + .override_reason); this function returns
 * the AC-prescribed derived value only.
 *
 * Depth thresholds per Table 4-1:
 *   - Wet:  ≤ 1/8 in → 5, > 1/8 in → 3 (deeper standing water → 2)
 *   - Slush: ≤ 1/8 in → 3 (treat as wet), > 1/8 in → 3, > 1/2 in → 2
 *   - Dry snow:  ≤ 1 in → 4, > 1 in → 3
 *   - Wet snow:  ≤ 1 in → 3, > 1 in → 2
 *   - Compacted snow: temp-dependent (< -15°C → 4, -15 to -3 → 3, > -3 → 2)
 */
export function deriveRwycc(input: {
  contaminant: Contaminant
  depthInches?: number | null
  temperatureC?: number | null
}): RwyccCode {
  const { contaminant, depthInches, temperatureC } = input
  const depth = depthInches ?? 0

  switch (contaminant) {
    case 'dry':                     return 6
    case 'frost':                   return 5
    case 'wet':
      if (depth <= 0.125) return 5
      if (depth > 0.5)    return 2
      return 3
    case 'slush':
      // Slush is always at least RwyCC 3; thicker = 2
      if (depth > 0.5)    return 2
      return 3
    case 'slippery_when_wet':       return 3
    case 'dry_snow':
      return depth <= 1 ? 4 : 3
    case 'wet_snow':
      return depth <= 1 ? 3 : 2
    case 'compacted_snow':
      if (temperatureC !== null && temperatureC !== undefined) {
        if (temperatureC < -15) return 4
        if (temperatureC < -3)  return 3
        return 2
      }
      return 3 // conservative default when temp unknown
    case 'ice_patches':             return 3
    case 'ice':                     return 1
    case 'wet_ice':                 return 0
    case 'water_on_compacted_snow': return 0
    case 'slush_on_ice':            return 0
    default:                        return 0
  }
}

// ────────────────────────────────────────────────────────────────
// FICON NOTAM text generator per AC 30D §6
// ────────────────────────────────────────────────────────────────

export type FiconThird = {
  third: Third
  contaminant: Contaminant
  coveragePercent: number
  depthInches?: number | null
  rwycc: RwyccCode
}

/**
 * Builds the AC 150/5200-30D §6 FICON NOTAM body that the operator pastes
 * into the FAA NOTAM Manager web tool. FAA NM wraps the body in the
 * standard Q-line / header automatically.
 *
 * Format anatomy:
 *   RWY <id> <CC>/<CC>/<CC> <cov%>/<cov%>/<cov%> PCT <contaminant tokens>[ <depth>IN][ TRTD W/<treatments>]
 *
 * Examples (smoke-tested against AC 30D Appendix B examples):
 *   "RWY 13/31 5/5/5 100/100/100 PCT WET"
 *   "RWY 06L/24R 3/3/2 80/100/100 PCT COMPACTED SN 2IN TRTD W/SAND"
 *   "RWY 09/27 5/3/2 100/100/100 PCT WET DRY SN COMPACTED SN 1.5IN TRTD W/PLOW W/CHEM"
 *
 * thirds is expected in TD → MID → RO order; we sort defensively in case
 * the caller passes them out of order.
 */
export function buildFiconNotamText(input: {
  runwayDesignator: string                // '13/31' or '06L/24R'
  thirds: FiconThird[]
  treatments: Treatment[]
}): string {
  const { runwayDesignator, thirds, treatments } = input

  // Sort TD → MID → RO defensively
  const sorted = [...thirds].sort(
    (a, b) => THIRD_ORDER.indexOf(a.third) - THIRD_ORDER.indexOf(b.third),
  )

  // RwyCC tuple
  const rwyccTuple = sorted.map((t) => t.rwycc).join('/')

  // Coverage tuple
  const covTuple = sorted.map((t) => Math.round(t.coveragePercent)).join('/')

  // Contaminant tokens — list each distinct one in order of appearance
  // across thirds (TD first). Duplicates collapsed. AC 30D Appendix B
  // examples list every per-third contaminant explicitly when they differ
  // and a single token when uniform.
  const tokens: string[] = []
  for (const t of sorted) {
    const token = CONTAMINANT_NOTAM_TOKENS[t.contaminant]
    if (!tokens.includes(token)) tokens.push(token)
  }
  const contaminantStr = tokens.join(' ')

  // Depth — pick the maximum depth across thirds (operationally the worst)
  const maxDepth = Math.max(0, ...sorted.map((t) => t.depthInches ?? 0))
  const depthStr = maxDepth > 0 ? ` ${formatDepth(maxDepth)}IN` : ''

  // Treatments — filter 'none', map to tokens, prefix " TRTD W/"
  const activeTreatments = treatments.filter((t) => t !== 'none')
  const treatmentTokens = activeTreatments
    .map((t) => TREATMENT_NOTAM_TOKENS[t])
    .filter((s): s is string => !!s)
  const treatmentStr = treatmentTokens.length > 0
    ? ` TRTD W/${treatmentTokens.join(' W/')}`
    : ''

  return `RWY ${runwayDesignator} ${rwyccTuple} ${covTuple} PCT ${contaminantStr}${depthStr}${treatmentStr}`
}

/** Formats depth as "1IN" / "1.5IN" / "0.5IN" — drops trailing .0 */
function formatDepth(depth: number): string {
  if (Number.isInteger(depth)) return String(depth)
  // Trim trailing zeros after the decimal (e.g. 1.50 → 1.5)
  return String(parseFloat(depth.toFixed(2)))
}

// ────────────────────────────────────────────────────────────────
// Display helpers
// ────────────────────────────────────────────────────────────────

/** Color cue for an RwyCC value (best = green, nil = danger). Maps to theme vars. */
export function rwyccColor(code: RwyccCode): string {
  if (code >= 5) return 'var(--color-success)'
  if (code === 4) return 'var(--color-success)'
  if (code === 3) return 'var(--color-warning)'
  if (code === 2) return 'var(--color-warning)'
  return 'var(--color-danger)' // 0 or 1
}

/** Human-readable label for an RwyCC value per AC 30D §4. */
export function rwyccDescriptor(code: RwyccCode): string {
  switch (code) {
    case 6: return 'Dry'
    case 5: return 'Good'
    case 4: return 'Good to Medium'
    case 3: return 'Medium'
    case 2: return 'Medium to Poor'
    case 1: return 'Poor'
    case 0: return 'Nil (closed for operations)'
  }
}
