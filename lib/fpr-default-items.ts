/**
 * Proposed default Flight Planning Room (FPR) check items.
 *
 * These are locally-editable seed suggestions, NOT DAFMAN text. Per
 * house regulatory-honesty rules, no item below carries a paragraph
 * citation — the FPR check requirement itself rests on unverified
 * community-wiki / PWS-snippet evidence (see the design spec's
 * §Regulatory basis and §Assumptions:
 * docs/superpowers/specs/2026-07-16-flight-planning-room-check-design.md).
 * "Develop procedures" means the checklist content is locally
 * determined per base — admins load this list via "Load default
 * checklist" in the FPR Checklist Base Setup tab, then rename, reorder,
 * deactivate, or add items to match local practice. Verify every item
 * against the current DAFMAN 13-204 Volume 2 and local instructions
 * before relying on it.
 */

export type FprDefaultItem = {
  label: string
  guidance?: string
}

export const FPR_DEFAULT_ITEMS: FprDefaultItem[] = [
  {
    label: 'FLIP products current',
    guidance: 'Correct edition/cycle posted; electronic media is an acceptable substitute for paper copies.',
  },
  {
    label: 'Enroute and terminal charts current',
    guidance: 'Charts on the rack reflect the current edition and are complete for the assigned area of responsibility.',
  },
  {
    label: 'Flight plan forms stocked',
    guidance: 'DD Form 175 and DD Form 1801 stock available at the planning counter.',
  },
  {
    label: 'NOTAM display current',
    guidance: 'Posted or electronic NOTAM display reflects the current issue.',
  },
  {
    label: 'Airfield diagram posted and current',
    guidance: 'Diagram on display matches the current airfield configuration.',
  },
  {
    label: 'Weather briefing access functional',
    guidance: 'Weather terminal, briefing line, or equivalent access is operational.',
  },
  {
    label: 'Planning-area computers/printer operational',
    guidance: 'Flight-planning computers and printer power on and function normally.',
  },
  {
    label: 'Local in-flight guide publications current',
    guidance: 'Locally produced flight guides/binders reflect the latest revision.',
  },
]
