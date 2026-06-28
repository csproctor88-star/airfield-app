import { ClipboardList, AlertTriangle, Clock, HardHat, ListChecks, Radio, Plane, DoorOpen, LayoutGrid, Link2, Globe, BarChart3, ScrollText, Bird, ShieldCheck, Users, Wrench, CheckSquare, RadioTower, CloudSnow, MessageSquare, GraduationCap, StickyNote } from 'lucide-react'
import type { WidgetDef, WidgetMeta } from '@/lib/dashboard/widget-registry'
import { TitleConfigForm } from '@/components/dashboard/table/title-config-form'
import { TableWidget } from '@/components/dashboard/table/table-widget'
import { TableConfigForm } from '@/components/dashboard/table/table-config-form'
import type { TableWidgetDescriptor } from '@/lib/dashboard/table/types'

/** Build a table-kind WidgetDef from metadata + a descriptor. */
function tableWidget<Row>(
  meta: Omit<WidgetMeta, 'kind'>,
  descriptor: TableWidgetDescriptor<Row>,
): WidgetDef {
  return {
    ...meta,
    kind: 'table',
    Component: (p) => <TableWidget descriptor={descriptor} config={p.config} />,
    ConfigForm: (p) => <TableConfigForm {...p} descriptor={descriptor} />,
  }
}
import { PERM } from '@/lib/permissions'
import { discrepanciesDescriptor } from '@/lib/dashboard/table/descriptors/discrepancies'
import { InspectionStatusWidget } from '@/components/dashboard/widgets/inspection-status-widget'
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
import { EventsLogWidget } from '@/components/dashboard/widgets/events-log-widget'
import { WildlifeWidget } from '@/components/dashboard/widgets/wildlife-widget'
import { WaiversWidget } from '@/components/dashboard/widgets/waivers-widget'
import { UsersWidget } from '@/components/dashboard/widgets/users-widget'
import { CesWidget } from '@/components/dashboard/widgets/ces-widget'
import { DailyReviewsWidget } from '@/components/dashboard/widgets/daily-reviews-widget'
import { InfrastructureWidget } from '@/components/dashboard/widgets/infrastructure-widget'
import { FieldConditionsWidget } from '@/components/dashboard/widgets/field-conditions-widget'
import { FeedbackWidget } from '@/components/dashboard/widgets/feedback-widget'
import { AmtrWidget } from '@/components/dashboard/widgets/amtr-widget'
import { NotesWidget, NotesConfigForm } from '@/components/dashboard/widgets/notes-widget'
import { ClockWidget } from '@/components/dashboard/widgets/clock-widget'

export const WIDGETS: Record<string, WidgetDef> = {
  'inspection-status': {
    type: 'inspection-status', kind: 'native', title: 'Inspection Status',
    description: "Today's airfield + lighting inspections",
    icon: ClipboardList, defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 },
    Component: () => <InspectionStatusWidget />,
    ConfigForm: TitleConfigForm,
  },
  'open-discrepancies': tableWidget({
    type: 'open-discrepancies', title: 'Open Discrepancies',
    description: 'Live discrepancy list', icon: AlertTriangle,
    defaultSize: { w: 4, h: 3 }, minSize: { w: 2, h: 2 },
    permission: PERM.DISCREPANCIES_VIEW,
  }, discrepanciesDescriptor),
  'last-check': {
    type: 'last-check', kind: 'native', title: 'Last Check',
    description: 'Most recent completed check',
    icon: Clock, defaultSize: { w: 3, h: 1 }, minSize: { w: 2, h: 1 },
    Component: () => <LastCheckWidget />,
    ConfigForm: TitleConfigForm,
  },
  'personnel': {
    type: 'personnel', kind: 'native', title: 'Personnel on Airfield',
    description: 'Active personnel now',
    icon: HardHat, defaultSize: { w: 3, h: 3 }, minSize: { w: 2, h: 2 },
    moduleHref: '/contractors',
    Component: () => <PersonnelWidget />,
    ConfigForm: TitleConfigForm,
  },
  'shift-checklist': {
    type: 'shift-checklist', kind: 'native', title: 'Shift Checklist',
    description: "Today's checklist progress",
    icon: ListChecks, defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 1 },
    moduleHref: '/shift-checklist',
    Component: () => <ShiftChecklistWidget />,
    ConfigForm: TitleConfigForm,
  },
  'notams': {
    type: 'notams', kind: 'native', title: 'Active NOTAMs',
    description: 'Current NOTAMs',
    icon: Radio, defaultSize: { w: 4, h: 3 }, minSize: { w: 2, h: 2 },
    moduleHref: '/notams',
    Component: () => <NotamsWidget />,
    ConfigForm: TitleConfigForm,
  },
  'ppr-today': {
    type: 'ppr-today', kind: 'native', title: 'PPR Today',
    description: "Today's arrivals",
    icon: Plane, defaultSize: { w: 3, h: 3 }, minSize: { w: 2, h: 2 },
    moduleHref: '/ppr',
    Component: () => <PprTodayWidget />,
    ConfigForm: TitleConfigForm,
  },
  'afm-toggles': {
    type: 'afm-toggles', kind: 'native', title: 'AFM Status',
    description: 'Out of Office / Close Airfield',
    icon: DoorOpen, defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 1 },
    permission: PERM.AIRFIELD_STATUS_WRITE,
    Component: () => <AfmTogglesWidget />,
    ConfigForm: TitleConfigForm,
  },
  'quick-actions': {
    type: 'quick-actions', kind: 'native', title: 'Quick Actions',
    description: 'Module launcher tiles',
    icon: LayoutGrid, defaultSize: { w: 4, h: 2 }, minSize: { w: 2, h: 1 },
    Component: (p) => <QuickActionsWidget config={p.config} />,
    ConfigForm: TitleConfigForm,
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
  'events-log': {
    type: 'events-log', kind: 'native', title: 'Events Log',
    description: 'Recent activity log entries (AF Form 3616)',
    icon: ScrollText, defaultSize: { w: 4, h: 3 }, minSize: { w: 2, h: 2 },
    permission: PERM.ACTIVITY_LOG_VIEW,
    moduleHref: '/activity',
    Component: () => <EventsLogWidget />,
    ConfigForm: TitleConfigForm,
  },
  'wildlife': {
    type: 'wildlife', kind: 'native', title: 'BASH / Wildlife',
    description: 'Sightings and strikes in the last 30 days',
    icon: Bird, defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 },
    permission: PERM.WILDLIFE_VIEW,
    moduleHref: '/wildlife',
    Component: () => <WildlifeWidget />,
    ConfigForm: TitleConfigForm,
  },
  'waivers': {
    type: 'waivers', kind: 'native', title: 'Waivers',
    description: 'Active waivers and upcoming expirations',
    icon: ShieldCheck, defaultSize: { w: 3, h: 3 }, minSize: { w: 2, h: 2 },
    permission: PERM.WAIVERS_VIEW,
    moduleHref: '/waivers',
    Component: () => <WaiversWidget />,
    ConfigForm: TitleConfigForm,
  },
  'users': {
    type: 'users', kind: 'native', title: 'User Management',
    description: 'Users at this base and pending approvals',
    icon: Users, defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 },
    permission: PERM.USERS_MANAGE,
    Component: () => <UsersWidget />,
    ConfigForm: TitleConfigForm,
  },
  'ces': {
    type: 'ces', kind: 'native', title: 'CES Work Orders',
    description: 'Open discrepancies routed to Civil Engineering',
    icon: Wrench, defaultSize: { w: 4, h: 3 }, minSize: { w: 2, h: 2 },
    permission: PERM.CES_VIEW,
    moduleHref: '/ces',
    Component: () => <CesWidget />,
    ConfigForm: TitleConfigForm,
  },
  'daily-reviews': {
    type: 'daily-reviews', kind: 'native', title: 'Daily Reviews',
    description: 'Shift sign-off queue for the last 7 days',
    icon: CheckSquare, defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 },
    permission: PERM.DAILY_REVIEWS_VIEW,
    moduleHref: '/daily-reviews',
    Component: () => <DailyReviewsWidget />,
    ConfigForm: TitleConfigForm,
  },
  'infrastructure': {
    type: 'infrastructure', kind: 'native', title: 'Infrastructure Status',
    description: 'Visual NAVAID / airfield lighting operational status',
    icon: RadioTower, defaultSize: { w: 3, h: 3 }, minSize: { w: 2, h: 2 },
    permission: PERM.INFRASTRUCTURE_VIEW,
    moduleHref: '/infrastructure',
    Component: () => <InfrastructureWidget />,
    ConfigForm: TitleConfigForm,
  },
  'field-conditions': {
    type: 'field-conditions', kind: 'native', title: 'Field Conditions',
    description: 'Active runway condition reports (RwyCC / FICON)',
    icon: CloudSnow, defaultSize: { w: 3, h: 3 }, minSize: { w: 2, h: 2 },
    permission: PERM.FIELD_CONDITIONS_READ,
    moduleHref: '/field-conditions',
    Component: () => <FieldConditionsWidget />,
    ConfigForm: TitleConfigForm,
  },
  'feedback': {
    type: 'feedback', kind: 'native', title: 'Customer Feedback',
    description: 'Submission count and average rating (last 30 days)',
    icon: MessageSquare, defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 },
    permission: PERM.FEEDBACK_VIEW,
    moduleHref: '/feedback',
    Component: () => <FeedbackWidget />,
    ConfigForm: TitleConfigForm,
  },
  'amtr': {
    type: 'amtr', kind: 'native', title: 'AMTR Training',
    description: 'Airfield Management Training Record — member count by status',
    icon: GraduationCap, defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 },
    permission: PERM.AMTR_VIEW,
    moduleHref: '/amtr',
    Component: () => <AmtrWidget />,
    ConfigForm: TitleConfigForm,
  },
  'notes': {
    type: 'notes', kind: 'native', title: 'Notes',
    description: 'A free-form sticky note',
    icon: StickyNote, defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 1 },
    Component: (p) => <NotesWidget config={p.config} />,
    ConfigForm: NotesConfigForm,
  },
  'clock': {
    type: 'clock', kind: 'native', title: 'Zulu Clock',
    description: 'Current Zulu and local time',
    icon: Clock, defaultSize: { w: 2, h: 2 }, minSize: { w: 2, h: 1 },
    Component: () => <ClockWidget />,
    ConfigForm: TitleConfigForm,
  },
}

export function getWidgetDef(type: string): WidgetDef | undefined {
  return WIDGETS[type]
}

export const ALL_WIDGET_METAS = Object.values(WIDGETS).map(({ Component, ConfigForm, ...meta }) => meta)
