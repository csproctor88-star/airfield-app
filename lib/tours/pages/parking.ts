import type { TourStep } from '@/components/tour/OnboardingTour'

// Deep parking tour. Each step uses `dispatchOnEnter` to drive the actual
// parking page state — opening the floating panel, switching tabs,
// showing the aircraft picker — so the user sees the live UI being
// described instead of a static screenshot. The page registers
// listeners for `glidepath:tour-parking-*` events in its main effect.
export const PARKING_PAGE_TOUR: TourStep[] = [
  {
    id: 'parking-intro',
    anchor: 'parking-header',
    // Reset to a clean state for the start of the tour: panel closed,
    // tab back on aircraft. (No-op on first visit; matters for replays.)
    dispatchOnEnter: { event: 'glidepath:tour-parking-close-panel' },
    title: 'Aircraft Parking',
    body:
      'Plan transient and resident parking with wingtip + taxilane ' +
      'clearance envelopes per UFC 3-260-01. Drag aircraft, set ' +
      'heading, and the engine ray-tests against runways, taxiways, ' +
      'and adjacent spots in real time. Plans persist per base — ' +
      'multiple drafts plus one Active that drives ARFF and ATC views.',
  },
  {
    id: 'parking-toolbar',
    anchor: 'parking-toolbar',
    title: 'Map toolbar',
    body:
      'Vertical rail at the top-left: Panel toggle, Fullscreen, Ruler, ' +
      'then plan-edit tools (add aircraft, draw obstacles + taxilanes + ' +
      'apron boundaries, lock toggles for AC and obstacles). PDF and ' +
      'Email at the bottom export the active plan.',
  },
  {
    id: 'parking-open-panel',
    anchor: 'parking-panel',
    dispatchOnEnter: { event: 'glidepath:tour-parking-open-panel' },
    title: 'The plan panel',
    body:
      'Resizable floating panel (drag the right edge or bottom-right ' +
      'corner). Header has the plan selector, status pill (Draft / ' +
      'Active / Template), Set Active, Duplicate, and a More menu for ' +
      'Save-as-Template and Delete. Close with the Panel toggle in the ' +
      'toolbar — content stays editable from the map directly.',
  },
  {
    id: 'parking-tabs',
    anchor: 'parking-tabs',
    dispatchOnEnter: { event: 'glidepath:tour-parking-set-tab', detail: 'aircraft' },
    title: 'Four tabs',
    body:
      'Aircraft, Environment, Clearance, Settings. Counts on each tab ' +
      'reflect the current plan; the Clearance count flips red on ' +
      'violations and amber on warnings so problems surface the moment ' +
      'they appear, even if you are working in another tab.',
  },
  {
    id: 'parking-aircraft-tab',
    anchor: 'parking-tabs',
    dispatchOnEnter: { event: 'glidepath:tour-parking-set-tab', detail: 'aircraft' },
    title: 'Aircraft tab',
    body:
      'Lists every placed aircraft grouped by type, with ADG badge + ' +
      'wingspan + per-spot violations. Box Select draws a rectangle on ' +
      'the map to multi-select; the multi-select panel up top batches ' +
      'heading rotations, clearance overrides, and bulk delete. ' +
      'Right-click any silhouette on the map for the per-spot context ' +
      'menu (tail #, callsign, status, fly-to, duplicate).',
  },
  {
    id: 'parking-aircraft-picker',
    anchor: 'parking-aircraft-picker',
    dispatchOnEnter: { event: 'glidepath:tour-parking-show-picker' },
    waitForAnchorMs: 5000,
    title: 'Aircraft picker',
    body:
      'Click + Add Aircraft — full library of military and commercial ' +
      'airframes, searchable, filterable by category, with a heading ' +
      'pre-set in the header. Pick one, then click the map to place. ' +
      'Bulk-add lets you place several of the same type in a row.',
  },
  {
    id: 'parking-environment-tab',
    anchor: 'parking-tabs',
    dispatchOnEnter: { event: 'glidepath:tour-parking-set-tab', detail: 'environment' },
    title: 'Environment tab',
    body:
      'Obstacles (point + circle + line + building polygons), taxilanes ' +
      '(interior + peripheral, each with its own envelope half-width), ' +
      'and apron boundaries. The drawing tools live in the toolbar ' +
      'rail; finished objects show up here for naming, editing point ' +
      'positions, and toggling visibility on the map.',
  },
  {
    id: 'parking-clearance-tab',
    anchor: 'parking-tabs',
    dispatchOnEnter: { event: 'glidepath:tour-parking-set-tab', detail: 'clearance' },
    title: 'Clearance engine',
    body:
      'Live UFC 3-260-01 evaluation — wingtip envelopes by ADG group, ' +
      'taxilane half-widths derived from the ADG of the largest ' +
      'aircraft on the apron, and pairwise checks for adjacent spots. ' +
      'Each row tells you which two objects clash and by how many feet. ' +
      'Filter to violations / warnings / OK; the UFC reference table ' +
      'at the bottom is the cite chain for any ruling you make.',
  },
  {
    id: 'parking-settings-tab',
    anchor: 'parking-tabs',
    dispatchOnEnter: { event: 'glidepath:tour-parking-set-tab', detail: 'settings' },
    title: 'Plan settings',
    body:
      'Per-plan: name, description, apron context (Parking / Taxiway / ' +
      'Loading), default per-spot clearance override. The apron context ' +
      'flips which UFC table the engine reads — Parking apron uses ' +
      'Table 6.1A; Taxiway/Loading shift the values accordingly. ' +
      'Status (Draft / Active / Template) is set from the panel header.',
  },
  {
    id: 'parking-export',
    anchor: 'parking-toolbar',
    dispatchOnEnter: { event: 'glidepath:tour-parking-hide-picker' },
    title: 'Export and share',
    body:
      'PDF emits a to-scale plan view with aircraft list, violations ' +
      'summary, and the UFC cite. Email sends the same PDF through the ' +
      'branded Resend pipeline (default to-address from base setup). ' +
      'The Active plan is what other modules (ARFF, transient board, ' +
      'PPR coordination) read — set status from the panel header.',
  },
]
