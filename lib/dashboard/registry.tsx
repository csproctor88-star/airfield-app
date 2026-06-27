import { ClipboardList, AlertTriangle, Clock, HardHat, ListChecks, Radio, Plane, DoorOpen, LayoutGrid, Link2, Globe, BarChart3 } from 'lucide-react'
import type { WidgetDef } from '@/lib/dashboard/widget-registry'
import { PERM } from '@/lib/permissions'
import { InspectionStatusWidget } from '@/components/dashboard/widgets/inspection-status-widget'
import { OpenDiscrepanciesWidget } from '@/components/dashboard/widgets/open-discrepancies-widget'
import { LastCheckWidget } from '@/components/dashboard/widgets/last-check-widget'
import { PersonnelWidget } from '@/components/dashboard/widgets/personnel-widget'
import { ShiftChecklistWidget } from '@/components/dashboard/widgets/shift-checklist-widget'
import { NotamsWidget } from '@/components/dashboard/widgets/notams-widget'
import { PprTodayWidget } from '@/components/dashboard/widgets/ppr-today-widget'
import { AfmTogglesWidget } from '@/components/dashboard/widgets/afm-toggles-widget'
import { QuickActionsWidget } from '@/components/dashboard/widgets/quick-actions-widget'
import { LinksWidget, LinksConfigForm } from '@/components/dashboard/widgets/links-widget'
import { EmbedWidget, EmbedConfigForm } from '@/components/dashboard/widgets/embed-widget'
import { AnalyticsWidget, AnalyticsConfigForm } from '@/components/dashboard/widgets/analytics-widget'

export const WIDGETS: Record<string, WidgetDef> = {
  'inspection-status': {
    type: 'inspection-status', kind: 'native', title: 'Inspection Status',
    description: "Today's airfield + lighting inspections",
    icon: ClipboardList, defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 },
    Component: () => <InspectionStatusWidget />,
  },
  'open-discrepancies': {
    type: 'open-discrepancies', kind: 'native', title: 'Open Discrepancies',
    description: 'Live open discrepancy list',
    icon: AlertTriangle, defaultSize: { w: 4, h: 3 }, minSize: { w: 2, h: 2 },
    permission: PERM.DISCREPANCIES_VIEW,
    Component: () => <OpenDiscrepanciesWidget />,
  },
  'last-check': {
    type: 'last-check', kind: 'native', title: 'Last Check',
    description: 'Most recent completed check',
    icon: Clock, defaultSize: { w: 3, h: 1 }, minSize: { w: 2, h: 1 },
    Component: () => <LastCheckWidget />,
  },
  'personnel': {
    type: 'personnel', kind: 'native', title: 'Personnel on Airfield',
    description: 'Active personnel now',
    icon: HardHat, defaultSize: { w: 3, h: 3 }, minSize: { w: 2, h: 2 },
    moduleHref: '/contractors',
    Component: () => <PersonnelWidget />,
  },
  'shift-checklist': {
    type: 'shift-checklist', kind: 'native', title: 'Shift Checklist',
    description: "Today's checklist progress",
    icon: ListChecks, defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 1 },
    moduleHref: '/shift-checklist',
    Component: () => <ShiftChecklistWidget />,
  },
  'notams': {
    type: 'notams', kind: 'native', title: 'Active NOTAMs',
    description: 'Current NOTAMs',
    icon: Radio, defaultSize: { w: 4, h: 3 }, minSize: { w: 2, h: 2 },
    moduleHref: '/notams',
    Component: () => <NotamsWidget />,
  },
  'ppr-today': {
    type: 'ppr-today', kind: 'native', title: 'PPR Today',
    description: "Today's arrivals",
    icon: Plane, defaultSize: { w: 3, h: 3 }, minSize: { w: 2, h: 2 },
    moduleHref: '/ppr',
    Component: () => <PprTodayWidget />,
  },
  'afm-toggles': {
    type: 'afm-toggles', kind: 'native', title: 'AFM Status',
    description: 'Out of Office / Close Airfield',
    icon: DoorOpen, defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 1 },
    permission: PERM.AIRFIELD_STATUS_WRITE,
    Component: () => <AfmTogglesWidget />,
  },
  'quick-actions': {
    type: 'quick-actions', kind: 'native', title: 'Quick Actions',
    description: 'Module launcher tiles',
    icon: LayoutGrid, defaultSize: { w: 4, h: 2 }, minSize: { w: 2, h: 1 },
    Component: (p) => <QuickActionsWidget config={p.config} />,
  },
  'links': {
    type: 'links', kind: 'links', title: 'Links',
    description: 'A list of bookmarks that open in a new tab',
    icon: Link2, defaultSize: { w: 3, h: 3 }, minSize: { w: 2, h: 2 },
    Component: (p) => <LinksWidget config={p.config} />,
    ConfigForm: LinksConfigForm,
  },
  'embed': { type: 'embed', kind: 'embed', title: 'Web Embed', description: 'Embed an external website', icon: Globe, defaultSize: { w: 4, h: 4 }, minSize: { w: 2, h: 3 }, Component: (p) => <EmbedWidget config={p.config} />, ConfigForm: EmbedConfigForm },
  'analytics': { type: 'analytics', kind: 'analytics', title: 'Analytics', description: 'A custom chart you build from your data', icon: BarChart3, defaultSize: { w: 4, h: 3 }, minSize: { w: 2, h: 2 }, Component: (p) => <AnalyticsWidget config={p.config} />, ConfigForm: AnalyticsConfigForm },
}

export function getWidgetDef(type: string): WidgetDef | undefined {
  return WIDGETS[type]
}

export const ALL_WIDGET_METAS = Object.values(WIDGETS).map(({ Component, ConfigForm, ...meta }) => meta)
