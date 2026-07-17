/**
 * Proposed default Airfield Driving Spot Check items.
 *
 * These are locally-editable seed suggestions, NOT DAFI text. Per house
 * regulatory-honesty rules, no item below carries a paragraph citation —
 * DAFI 13-213 itself was unverified through the research environment's
 * egress proxy (see the design spec's §Regulatory basis and
 * §Assumptions & open questions:
 * docs/superpowers/specs/2026-07-16-airfield-driving-spot-check-design.md).
 * Admins load this list via "Load default items" in the Driving Check
 * Items Base Setup tab, then rename, reorder, deactivate, or add items to
 * match local wing-supplement procedures.
 *
 * AF Form 483 verification is a dedicated form field on the check
 * (Valid / Expired / Not in Possession / None Issued segmented control),
 * NOT a checklist item — do not add one here.
 *
 * Verify every item against the current DAFI 13-213 and local wing
 * supplement before relying on it.
 */

export type DrivingCheckDefaultItem = {
  label: string
  guidance?: string
}

export const DRIVING_CHECK_DEFAULT_ITEMS: DrivingCheckDefaultItem[] = [
  {
    label: 'Two-way radio contact operational',
    guidance: 'Radio contact with tower/AM Ops on the correct frequency is functioning, or the vehicle is under a radio-equipped escort while in the Controlled Movement Area.',
  },
  {
    label: 'FOD tire check performed',
    guidance: 'Tires and undercarriage inspected for debris before and after departing an unpaved surface, consistent with routine FOD Check procedures.',
  },
  {
    label: 'Vehicle beacon/lighting operational',
    guidance: 'Rotating beacon and required vehicle lighting are functioning and in use.',
  },
  {
    label: 'Seat belts in use',
    guidance: 'Driver and any occupants are wearing seat belts.',
  },
  {
    label: 'Speed limit compliance',
    guidance: 'Vehicle observed operating at or below the posted airfield speed limit.',
  },
  {
    label: 'Vehicle serviceability',
    guidance: 'Brakes, glass, and fluid lines free of visible leaks or damage that would affect safe airfield operation.',
  },
  {
    label: 'Driver knowledge of light-gun signals',
    guidance: 'Driver correctly identifies tower light-gun signal meanings when asked.',
  },
  {
    label: 'Escort procedures complied with',
    guidance: 'Escorted vehicles/personnel remained within escort control and followed briefed escort procedures.',
  },
]
