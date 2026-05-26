import { createClient } from '@/lib/supabase/client'

// ── Types ──

export type SidebarSection = {
  label: string
  items: string[]      // hrefs
  collapsed?: boolean  // persisted expanded/collapsed state
}

export type SidebarConfig = {
  pinned: string[]           // hrefs for always-visible top items
  sections: SidebarSection[]
}

// ── Master item registry (lookup by href) ──

export type NavItemDef = {
  name: string
  href: string
  iconName: string   // lucide icon name — resolved in sidebar component
}

export const ALL_NAV_ITEMS: NavItemDef[] = [
  { name: 'Airfield Status', href: '/', iconName: 'Home' },
  { name: 'Dashboard', href: '/dashboard', iconName: 'LayoutDashboard' },
  { name: 'Events Log', href: '/activity', iconName: 'Activity' },
  { name: 'Activity Log', href: '/recent-activity', iconName: 'History' },
  { name: 'QRC', href: '/qrc', iconName: 'Zap' },
  { name: 'Secondary Crash Net', href: '/scn', iconName: 'Radio' },
  { name: 'Shift Checklist', href: '/shift-checklist', iconName: 'ListChecks' },
  { name: 'Daily Reviews', href: '/daily-reviews', iconName: 'ClipboardPen' },
  { name: 'Airfield Checks', href: '/checks', iconName: 'ClipboardCheck' },
  { name: 'All Inspections', href: '/inspections/all', iconName: 'ClipboardList' },
  { name: 'Wildlife / BASH', href: '/wildlife', iconName: 'Bird' },
  { name: 'PPR Log', href: '/ppr', iconName: 'ClipboardPen' },
  { name: 'Customer Feedback', href: '/feedback', iconName: 'MessageSquare' },
  { name: 'Personnel on Airfield', href: '/contractors', iconName: 'HardHat' },
  // Field Conditions / TALPA — civilian Part 139 only (modules-config
  // `appliesTo: ['faa_part139']` filters this from USAF sidebars). Lives
  // under Operations since ops staff use it daily during winter / wet ops.
  { name: 'Field Conditions',  href: '/field-conditions', iconName: 'CloudSnow' },
  // Wildlife Hazard Management Plan — civilian Part 139 only.
  // Sits under Operations next to /wildlife since that module's
  // sightings + strikes data feeds the annual assessment narrative.
  { name: 'Wildlife / WHMP',   href: '/wildlife/whmp', iconName: 'ClipboardCheck' },
  // SMS — civilian Part 139 only; the modules-config `appliesTo: ['faa_part139']`
  // filter hides this from USAF sidebars at render time.
  { name: 'Safety Management', href: '/sms', iconName: 'ShieldAlert' },
  { name: 'Hazard Register',   href: '/sms/hazards', iconName: 'AlertTriangle' },
  { name: 'Safety Indicators', href: '/sms/spis', iconName: 'TrendingUp' },
  { name: 'Safety Reports',    href: '/sms/reports', iconName: 'MessageSquareWarning' },
  { name: 'SMS Audits',        href: '/sms/audits', iconName: 'ClipboardCheck' },
  { name: 'Management of Change', href: '/sms/moc', iconName: 'GitBranch' },
  // §139.303 Training — civilian Part 139 only (modules-config
  // `appliesTo: ['faa_part139']` filters this from USAF sidebars).
  { name: 'Training Overview', href: '/training', iconName: 'GraduationCap' },
  { name: 'Training Topics',   href: '/training/topics', iconName: 'BookOpen' },
  { name: 'Training Roster',   href: '/training/roster', iconName: 'Users' },
  { name: 'Training Compliance', href: '/training/compliance', iconName: 'ClipboardCheck' },
  // Airport Emergency Plan — civilian Part 139 only (modules-config
  // `appliesTo: ['faa_part139']` filters this from USAF sidebars). On
  // civilian bases this replaces the SCN entry.
  { name: 'Emergency Plan',     href: '/aep',              iconName: 'ShieldAlert' },
  { name: 'AEP Document',       href: '/aep/plan',         iconName: 'FileText' },
  { name: 'Response Agencies',  href: '/aep/agencies',     iconName: 'Users' },
  { name: 'AEP Comms Checks',   href: '/aep/comms-checks', iconName: 'Radio' },
  { name: 'AEP Drills',         href: '/aep/drills',       iconName: 'Siren' },
  // 'Training Records' (/amtr) is intentionally omitted from navigation while
  // in limited testing — the route stays live and is reachable by direct URL,
  // gated by the `amtr:view` permission. Re-add here to surface it in the sidebar.
  { name: 'CES Work Orders', href: '/ces', iconName: 'Wrench' },
  { name: 'Discrepancies', href: '/discrepancies', iconName: 'AlertTriangle' },
  { name: 'Obstruction Eval Tool', href: '/obstructions', iconName: 'MapPin' },
  { name: 'Waivers', href: '/waivers', iconName: 'Shield' },
  { name: 'Visual NAVAIDs', href: '/infrastructure', iconName: 'Lightbulb' },
  { name: 'Aircraft Parking', href: '/parking', iconName: 'PlaneLanding' },
  { name: 'Aircraft Database', href: '/aircraft', iconName: 'Plane' },
  { name: 'Reference Library', href: '/regulations', iconName: 'BookOpen' },
  { name: 'NOTAMs', href: '/notams', iconName: 'FileText' },
  { name: 'Reports & Analytics', href: '/reports', iconName: 'BarChart3' },
  { name: 'Settings', href: '/settings', iconName: 'Settings' },
  { name: 'PDF Library', href: '/library', iconName: 'BookMarked' },
  { name: 'User Management', href: '/users', iconName: 'Users' },
  { name: 'Help & Training', href: '/help', iconName: 'GraduationCap' },
  { name: 'Base Configuration', href: '/base-config', iconName: 'SlidersHorizontal' },
]

export const NAV_ITEM_MAP = new Map(ALL_NAV_ITEMS.map(i => [i.href, i]))

// ── Default config ──

export const DEFAULT_SIDEBAR_CONFIG: SidebarConfig = {
  pinned: ['/', '/dashboard'],
  sections: [
    {
      label: 'Operations',
      items: ['/activity', '/qrc', '/shift-checklist', '/checks', '/inspections/all', '/wildlife', '/wildlife/whmp', '/ppr', '/contractors', '/field-conditions'],
    },
    {
      label: 'Airfield Management',
      items: ['/discrepancies', '/ces', '/obstructions', '/infrastructure', '/parking'],
    },
    {
      label: 'Safety Management System',
      items: ['/sms', '/sms/hazards', '/sms/spis', '/sms/reports', '/sms/audits', '/sms/moc'],
    },
    {
      label: 'Training & Compliance',
      items: ['/training', '/training/topics', '/training/roster', '/training/compliance'],
    },
    {
      label: 'Airport Emergency Plan',
      items: ['/aep', '/aep/plan', '/aep/agencies', '/aep/comms-checks', '/aep/drills'],
    },
    {
      label: 'Reference',
      items: ['/aircraft', '/regulations', '/notams', '/help'],
    },
    {
      label: 'Admin',
      items: ['/base-config', '/recent-activity', '/daily-reviews', '/waivers', '/reports', '/library', '/users', '/feedback'],
    },
  ],
}

// ── Supabase persistence ──

export async function loadSidebarConfig(): Promise<SidebarConfig | null> {
  const supabase = createClient()
  if (!supabase) return null

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    const row = data as Record<string, unknown> | null
    if (!row?.sidebar_config) return null

    // Validate shape
    const cfg = row.sidebar_config as SidebarConfig
    if (!cfg.pinned || !cfg.sections) return null

    // Migrate legacy hrefs from prior renames (one-time inline rewrite — safe
    // to run every load because Set.has() will skip already-migrated entries).
    // Currently mapping: `/training` (the old in-app help) → `/help`, freed up
    // for the new §139.303 Training module that took the `/training` slug.
    const HREF_REWRITES: Record<string, string> = { '/training': '/help' }
    cfg.pinned = cfg.pinned.map(h => HREF_REWRITES[h] ?? h)
    cfg.sections.forEach(s => { s.items = s.items.map(h => HREF_REWRITES[h] ?? h) })

    // Merge any new nav items / sections from DEFAULT that aren't in the
    // saved config. Order matters: if a whole section is new (e.g. SMS
    // landed after the user saved their layout), insert the section at
    // the same index it occupies in DEFAULT so existing users don't get
    // its items dumped into Operations.
    const savedHrefs = new Set([
      ...cfg.pinned,
      ...cfg.sections.flatMap(s => s.items),
    ])
    DEFAULT_SIDEBAR_CONFIG.sections.forEach((section, defaultIdx) => {
      const target = cfg.sections.find(s => s.label === section.label)
      if (!target) {
        // Entire section is new — clone the DEFAULT entry and insert at
        // the same index so the natural ordering survives. clamp to the
        // current sections length so we don't insert past the end.
        const insertAt = Math.min(defaultIdx, cfg.sections.length)
        cfg.sections.splice(insertAt, 0, {
          label: section.label,
          items: section.items.filter(h => !savedHrefs.has(h)),
          collapsed: section.collapsed,
        })
        for (const h of section.items) savedHrefs.add(h)
        return
      }
      // Section exists — append any new items at the bottom.
      for (const href of section.items) {
        if (!savedHrefs.has(href)) {
          target.items.push(href)
          savedHrefs.add(href)
        }
      }
    })

    return cfg
  } catch {
    return null
  }
}

export async function saveSidebarConfig(config: SidebarConfig): Promise<boolean> {
  const supabase = createClient()
  if (!supabase) return false

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const { error } = await supabase
      .from('profiles')
      .update({ sidebar_config: config } as any)
      .eq('id', user.id)

    return !error
  } catch {
    return false
  }
}

export async function resetSidebarConfig(): Promise<boolean> {
  const supabase = createClient()
  if (!supabase) return false

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const { error } = await supabase
      .from('profiles')
      .update({ sidebar_config: null } as any)
      .eq('id', user.id)

    return !error
  } catch {
    return false
  }
}
