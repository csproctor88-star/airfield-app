import type { TourStep } from '@/components/tour/OnboardingTour'

export const INFRASTRUCTURE_PAGE_TOUR: TourStep[] = [
  {
    id: 'infrastructure-intro',
    anchor: 'infrastructure-header',
    title: 'Visual NAVAIDs',
    body:
      'Map view of every NAVAID component on the field — edge lights, ' +
      'PAPI, MALSR, ALSF, threshold bars, taxiway lighting. Each ' +
      'fixture has a status; the Outage Engine classifies outages into ' +
      'four tiers per DAFMAN 13-204v2 Table A3.1 and detects bar-out ' +
      'conditions across grouped fixtures.',
  },
  {
    id: 'infrastructure-health',
    anchor: 'infrastructure-health',
    title: 'Lighting Status panel',
    body:
      'Collapsible per-system rollup at the top: PAPI, MALSR, ALSF, ' +
      'edge lighting, threshold bars, taxiway centerline. INOP count ' +
      'flips red when anything is down. Click a system to expand its ' +
      'individual fixtures and recent outage events.',
  },
  {
    id: 'infrastructure-map',
    anchor: 'infrastructure-map',
    title: 'Click any fixture',
    body:
      'Each marker is one fixture. Click to inspect or report inop — ' +
      'the engine immediately re-evaluates the system tier and shows ' +
      'the outage ring (green / yellow / red / black) per A3.1. ' +
      'Reporting an outage auto-creates a discrepancy and routes it ' +
      'to the Electrical Light shop based on your base setup.',
  },
  {
    id: 'infrastructure-bars',
    anchor: 'infrastructure-map',
    title: 'Bar-level analysis',
    body:
      'Approach lighting and threshold systems are bar-grouped. ' +
      'analyzeBarOutages() flags a bar as inop when 3+ fixtures in the ' +
      'group are down (BAR_INOP_THRESHOLD), independent of the ' +
      'per-fixture count. Marking a fixture operational again prompts ' +
      'to close any linked discrepancies in one step.',
  },
  {
    id: 'infrastructure-modes',
    anchor: 'infrastructure-actions',
    title: 'Edit + Audit modes',
    body:
      'Edit Mode (admin): drag fixtures to correct positions, bulk-' +
      'shift, box-select, place new bars. Audit Mode: component-' +
      'grouped review with click-to-zoom — useful for the periodic ' +
      'NAVAID audit when verifying every fixture is on the map.',
  },
  {
    id: 'infrastructure-import',
    anchor: 'infrastructure-actions',
    title: 'Import Features',
    body:
      'Import Base Data seeds the page from your installation\'s ' +
      'standard NAVAID inventory. Import Features accepts KML uploads ' +
      'for one-off updates (new construction, runway re-numbering). ' +
      'Both are admin-only and write to the database with full audit ' +
      'history.',
  },
]
