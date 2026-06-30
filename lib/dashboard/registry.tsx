import { ClipboardList, AlertTriangle, Clock, HardHat, ListChecks, Radio, Plane, DoorOpen, LayoutGrid, Link2, Globe, BarChart3, ScrollText, Bird, ShieldCheck, Users, Wrench, CheckSquare, RadioTower, CloudSnow, MessageSquare, GraduationCap, StickyNote, TrendingUp, Lightbulb } from 'lucide-react'
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
    Component: (p) => <TableWidget descriptor={descriptor} config={p.config} onConfigChange={p.onConfigChange} />,
    ConfigForm: (p) => <TableConfigForm {...p} descriptor={descriptor} />,
  }
}
import { PERM } from '@/lib/permissions'
import { discrepanciesDescriptor } from '@/lib/dashboard/table/descriptors/discrepancies'
import { personnelDescriptor } from '@/lib/dashboard/table/descriptors/personnel'
import { pprDescriptor } from '@/lib/dashboard/table/descriptors/ppr'
import { cesDescriptor } from '@/lib/dashboard/table/descriptors/ces'
import { waiversDescriptor } from '@/lib/dashboard/table/descriptors/waivers'
import { notamsDescriptor } from '@/lib/dashboard/table/descriptors/notams'
import { dailyReviewsDescriptor } from '@/lib/dashboard/table/descriptors/daily-reviews'
import { eventsLogDescriptor } from '@/lib/dashboard/table/descriptors/events-log'
import { wildlifeDescriptor } from '@/lib/dashboard/table/descriptors/wildlife'
import { usersDescriptor } from '@/lib/dashboard/table/descriptors/users'
import { amtrOverdueDescriptor, amtrDueSoonDescriptor } from '@/lib/dashboard/table/descriptors/amtr-due-items'
import { amtrInspectionsDescriptor } from '@/lib/dashboard/table/descriptors/amtr-inspections'
import { InspectionStatusWidget } from '@/components/dashboard/widgets/inspection-status-widget'
import { LastCheckWidget } from '@/components/dashboard/widgets/last-check-widget'
import { ShiftChecklistWidget } from '@/components/dashboard/widgets/shift-checklist-widget'
import { AfmTogglesWidget } from '@/components/dashboard/widgets/afm-toggles-widget'
import { QuickActionsWidget, QuickActionsConfigForm } from '@/components/dashboard/widgets/quick-actions-widget'
import { LinksWidget, LinksConfigForm } from '@/components/dashboard/widgets/links-widget'
import { EmbedWidget, EmbedConfigForm } from '@/components/dashboard/widgets/embed-widget'
import { AnalyticsWidget, AnalyticsConfigForm } from '@/components/dashboard/widgets/analytics-widget'
import { InfrastructureWidget } from '@/components/dashboard/widgets/infrastructure-widget'
import { FieldConditionsWidget } from '@/components/dashboard/widgets/field-conditions-widget'
import { FeedbackWidget } from '@/components/dashboard/widgets/feedback-widget'
import { NotesWidget, NotesConfigForm } from '@/components/dashboard/widgets/notes-widget'
import { ClockWidget } from '@/components/dashboard/widgets/clock-widget'
import { ReportDiscrepanciesWidget } from '@/components/dashboard/widgets/report-discrepancies-widget'
import { ReportTrendsWidget } from '@/components/dashboard/widgets/report-trends-widget'
import { ReportAgingWidget } from '@/components/dashboard/widgets/report-aging-widget'
import { ReportLightingWidget } from '@/components/dashboard/widgets/report-lighting-widget'
import { ReportDailyWidget } from '@/components/dashboard/widgets/report-daily-widget'
import { AmtrKpisWidget } from '@/components/dashboard/widgets/amtr-kpis-widget'
import { AmtrWidget, AmtrReportConfigForm } from '@/components/dashboard/widgets/amtr-widget'

export const WIDGETS: Record<string, WidgetDef> = {
  'inspection-status': {
    type: 'inspection-status', kind: 'native', title: 'Inspection Status',
    description: "Today's airfield + lighting inspections",
    icon: ClipboardList, defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 4 },
    Component: () => <InspectionStatusWidget />,
    ConfigForm: TitleConfigForm,
  },
  'open-discrepancies': tableWidget({
    type: 'open-discrepancies', title: 'Open Discrepancies',
    description: 'Live discrepancy list', icon: AlertTriangle,
    defaultSize: { w: 8, h: 6 }, minSize: { w: 4, h: 4 },
    permission: PERM.DISCREPANCIES_VIEW,
  }, discrepanciesDescriptor),
  'last-check': {
    type: 'last-check', kind: 'native', title: 'Last Check',
    description: 'Most recent completed check',
    icon: Clock, defaultSize: { w: 6, h: 2 }, minSize: { w: 4, h: 2 },
    Component: () => <LastCheckWidget />,
    ConfigForm: TitleConfigForm,
  },
  'personnel': tableWidget({
    type: 'personnel', title: 'Personnel on Airfield',
    description: 'Active personnel now', icon: HardHat,
    defaultSize: { w: 8, h: 6 }, minSize: { w: 4, h: 4 },
    moduleHref: '/contractors',
  }, personnelDescriptor),
  'shift-checklist': {
    type: 'shift-checklist', kind: 'native', title: 'Shift Checklist',
    description: "Today's checklist progress",
    icon: ListChecks, defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 2 },
    moduleHref: '/shift-checklist',
    Component: () => <ShiftChecklistWidget />,
    ConfigForm: TitleConfigForm,
  },
  'notams': tableWidget({
    type: 'notams', title: 'Active NOTAMs',
    description: 'Current NOTAMs',
    icon: Radio, defaultSize: { w: 8, h: 6 }, minSize: { w: 4, h: 4 },
    moduleHref: '/notams',
  }, notamsDescriptor),
  'ppr-today': tableWidget({
    type: 'ppr-today', title: 'PPR', description: 'PPR arrivals',
    icon: Plane, defaultSize: { w: 8, h: 6 }, minSize: { w: 4, h: 4 },
    moduleHref: '/ppr',
  }, pprDescriptor),
  'afm-toggles': {
    type: 'afm-toggles', kind: 'native', title: 'AMOPS Status',
    description: 'Out of Office / Close Airfield',
    icon: DoorOpen, defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 2 },
    permission: PERM.AIRFIELD_STATUS_WRITE,
    Component: () => <AfmTogglesWidget />,
    ConfigForm: TitleConfigForm,
  },
  'quick-actions': {
    type: 'quick-actions', kind: 'native', title: 'Quick Actions',
    description: 'Module launcher tiles',
    icon: LayoutGrid, defaultSize: { w: 8, h: 4 }, minSize: { w: 4, h: 2 },
    Component: (p) => <QuickActionsWidget config={p.config} />,
    ConfigForm: QuickActionsConfigForm,
  },
  'links': {
    type: 'links', kind: 'links', title: 'Links',
    description: 'A list of bookmarks that open in a new tab',
    icon: Link2, defaultSize: { w: 6, h: 6 }, minSize: { w: 4, h: 4 },
    Component: (p) => <LinksWidget config={p.config} />,
    ConfigForm: LinksConfigForm,
  },
  'embed': { type: 'embed', kind: 'embed', title: 'Web Embed', description: 'Embed an external website', icon: Globe, defaultSize: { w: 8, h: 8 }, minSize: { w: 4, h: 6 }, Component: (p) => <EmbedWidget config={p.config} />, ConfigForm: EmbedConfigForm },
  'analytics': { type: 'analytics', kind: 'analytics', title: 'Analytics', description: 'A custom chart you build from your data', icon: BarChart3, defaultSize: { w: 8, h: 6 }, minSize: { w: 4, h: 4 }, Component: (p) => <AnalyticsWidget config={p.config} />, ConfigForm: AnalyticsConfigForm },
  'events-log': tableWidget({
    type: 'events-log', title: 'Events Log',
    description: 'Recent activity log entries (AF Form 3616)',
    icon: ScrollText, defaultSize: { w: 8, h: 6 }, minSize: { w: 4, h: 4 },
    permission: PERM.ACTIVITY_LOG_VIEW,
    moduleHref: '/activity',
  }, eventsLogDescriptor),
  'wildlife': tableWidget({
    type: 'wildlife', title: 'BASH / Wildlife',
    description: 'Sightings and strikes in the last 30 days',
    icon: Bird, defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 4 },
    permission: PERM.WILDLIFE_VIEW,
    moduleHref: '/wildlife',
  }, wildlifeDescriptor),
  'waivers': tableWidget({
    type: 'waivers', title: 'Waivers',
    description: 'Active waivers and upcoming expirations',
    icon: ShieldCheck, defaultSize: { w: 6, h: 6 }, minSize: { w: 4, h: 4 },
    permission: PERM.WAIVERS_VIEW,
    moduleHref: '/waivers',
  }, waiversDescriptor),
  'users': tableWidget({
    type: 'users', title: 'User Management',
    description: 'Users at this base and pending approvals',
    icon: Users, defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 4 },
    permission: PERM.USERS_MANAGE,
  }, usersDescriptor),
  'ces': tableWidget({
    type: 'ces', title: 'CES Work Orders',
    description: 'Open discrepancies routed to Civil Engineering',
    icon: Wrench, defaultSize: { w: 8, h: 6 }, minSize: { w: 4, h: 4 },
    permission: PERM.CES_VIEW,
    moduleHref: '/ces',
  }, cesDescriptor),
  'daily-reviews': tableWidget({
    type: 'daily-reviews', title: 'Daily Reviews',
    description: 'Shift sign-off queue for the last 7 days',
    icon: CheckSquare, defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 4 },
    permission: PERM.DAILY_REVIEWS_VIEW,
    moduleHref: '/daily-reviews',
  }, dailyReviewsDescriptor),
  'infrastructure': {
    type: 'infrastructure', kind: 'native', title: 'Infrastructure Status',
    description: 'Visual NAVAID / airfield lighting operational status',
    icon: RadioTower, defaultSize: { w: 6, h: 6 }, minSize: { w: 4, h: 4 },
    permission: PERM.INFRASTRUCTURE_VIEW,
    moduleHref: '/infrastructure',
    Component: (p) => <InfrastructureWidget config={p.config} editing={p.editing} onConfigChange={p.onConfigChange} />,
    ConfigForm: TitleConfigForm,
  },
  'field-conditions': {
    type: 'field-conditions', kind: 'native', title: 'Field Conditions',
    description: 'Active runway condition reports (RwyCC / FICON)',
    icon: CloudSnow, defaultSize: { w: 6, h: 6 }, minSize: { w: 4, h: 4 },
    permission: PERM.FIELD_CONDITIONS_READ,
    moduleHref: '/field-conditions',
    Component: () => <FieldConditionsWidget />,
    ConfigForm: TitleConfigForm,
  },
  'feedback': {
    type: 'feedback', kind: 'native', title: 'Customer Feedback',
    description: 'Submission count and average rating (last 30 days)',
    icon: MessageSquare, defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 4 },
    permission: PERM.FEEDBACK_VIEW,
    moduleHref: '/feedback',
    Component: () => <FeedbackWidget />,
    ConfigForm: TitleConfigForm,
  },
  'amtr': {
    type: 'amtr', kind: 'native', title: 'AMTR',
    description: 'Airfield Management Training Record — pick a report',
    icon: GraduationCap, defaultSize: { w: 8, h: 6 }, minSize: { w: 4, h: 4 },
    permission: PERM.AMTR_VIEW,
    moduleHref: '/amtr',
    Component: (p) => <AmtrWidget {...p} />,
    ConfigForm: AmtrReportConfigForm,
  },
  'amtr-kpis': {
    type: 'amtr-kpis', kind: 'native', title: 'AMTR — Unit KPIs',
    description: 'Members, required tasks, complete, due soon, and overdue at a glance',
    icon: TrendingUp, defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 4 },
    permission: PERM.AMTR_VIEW,
    moduleHref: '/amtr',
    hidden: true,
    Component: () => <AmtrKpisWidget />,
    ConfigForm: TitleConfigForm,
  },
  'amtr-overdue': tableWidget({
    type: 'amtr-overdue', title: 'AMTR — Overdue Training',
    description: 'Members with overdue 1098 / RAT items',
    icon: AlertTriangle, defaultSize: { w: 8, h: 6 }, minSize: { w: 4, h: 4 },
    permission: PERM.AMTR_VIEW,
    moduleHref: '/amtr',
    hidden: true,
  }, amtrOverdueDescriptor),
  'amtr-due-soon': tableWidget({
    type: 'amtr-due-soon', title: 'AMTR — Due Soon (30 days)',
    description: 'Recurring training coming due in the next 30 days',
    icon: Clock, defaultSize: { w: 8, h: 6 }, minSize: { w: 4, h: 4 },
    permission: PERM.AMTR_VIEW,
    moduleHref: '/amtr',
    hidden: true,
  }, amtrDueSoonDescriptor),
  'amtr-inspections': tableWidget({
    type: 'amtr-inspections', title: 'AMTR — Inspection Status',
    description: 'Each member\'s latest monthly record self-inspection',
    icon: ShieldCheck, defaultSize: { w: 8, h: 6 }, minSize: { w: 4, h: 4 },
    permission: PERM.AMTR_VIEW,
    moduleHref: '/amtr',
    hidden: true,
  }, amtrInspectionsDescriptor),
  'notes': {
    type: 'notes', kind: 'native', title: 'Notes',
    description: 'A free-form sticky note',
    icon: StickyNote, defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 2 },
    Component: (p) => <NotesWidget config={p.config} editing={p.editing} onConfigChange={p.onConfigChange} />,
    ConfigForm: NotesConfigForm,
  },
  'clock': {
    type: 'clock', kind: 'native', title: 'Zulu Clock',
    description: 'Current Zulu and local time — add multiple timezones',
    icon: Clock, defaultSize: { w: 4, h: 4 }, minSize: { w: 4, h: 2 },
    Component: (p) => <ClockWidget config={p.config} editing={p.editing} onConfigChange={p.onConfigChange} />,
    ConfigForm: TitleConfigForm,
  },
  'report-discrepancies': {
    type: 'report-discrepancies', kind: 'native', title: 'Discrepancy Report',
    description: 'Open discrepancy count, aging, and top shop at a glance',
    icon: AlertTriangle, defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 4 },
    permission: PERM.DISCREPANCIES_VIEW,
    moduleHref: '/discrepancies',
    Component: () => <ReportDiscrepanciesWidget />,
    ConfigForm: TitleConfigForm,
  },
  'report-trends': {
    type: 'report-trends', kind: 'native', title: 'Discrepancy Trends',
    description: 'Opened, closed, and net discrepancies over the last 30 days',
    icon: TrendingUp, defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 4 },
    permission: PERM.DISCREPANCIES_VIEW,
    moduleHref: '/discrepancies',
    Component: () => <ReportTrendsWidget />,
    ConfigForm: TitleConfigForm,
  },
  'report-aging': {
    type: 'report-aging', kind: 'native', title: 'Aging Discrepancies',
    description: 'Oldest open discrepancies and 90+ day count',
    icon: Clock, defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 4 },
    permission: PERM.DISCREPANCIES_VIEW,
    moduleHref: '/discrepancies',
    Component: () => <ReportAgingWidget />,
    ConfigForm: TitleConfigForm,
  },
  'report-lighting': {
    type: 'report-lighting', kind: 'native', title: 'Lighting Report',
    description: 'Total lighting features, inoperative count, and operational %',
    icon: Lightbulb, defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 4 },
    permission: PERM.INFRASTRUCTURE_VIEW,
    moduleHref: '/infrastructure',
    Component: () => <ReportLightingWidget />,
    ConfigForm: TitleConfigForm,
  },
  'report-daily': {
    type: 'report-daily', kind: 'native', title: 'Daily Operations',
    description: 'Inspections, checks, and new discrepancies over the last 30 days',
    icon: ClipboardList, defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 4 },
    permission: PERM.INSPECTIONS_VIEW,
    Component: () => <ReportDailyWidget />,
    ConfigForm: TitleConfigForm,
  },
}

export function getWidgetDef(type: string): WidgetDef | undefined {
  return WIDGETS[type]
}

export const ALL_WIDGET_METAS = Object.values(WIDGETS).map(({ Component, ConfigForm, ...meta }) => meta)
