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
  { name: 'QRC', href: '/qrc', iconName: 'Zap' },
  { name: 'Shift Checklist', href: '/shift-checklist', iconName: 'ListChecks' },
  { name: 'Airfield Checks', href: '/checks', iconName: 'ClipboardCheck' },
  { name: 'All Inspections', href: '/inspections/all', iconName: 'ClipboardList' },
  { name: 'Wildlife / BASH', href: '/wildlife', iconName: 'Bird' },
  { name: 'Personnel on Airfield', href: '/contractors', iconName: 'HardHat' },
  { name: 'Discrepancies', href: '/discrepancies', iconName: 'AlertTriangle' },
  { name: 'Obstruction Eval Tool', href: '/obstructions', iconName: 'MapPin' },
  { name: 'Obstruction Database', href: '/obstructions/history', iconName: 'Database' },
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
]

export const NAV_ITEM_MAP = new Map(ALL_NAV_ITEMS.map(i => [i.href, i]))

// ── Default config ──

export const DEFAULT_SIDEBAR_CONFIG: SidebarConfig = {
  pinned: ['/', '/dashboard', '/activity'],
  sections: [
    {
      label: 'Operations',
      items: ['/qrc', '/shift-checklist', '/checks', '/inspections/all', '/wildlife', '/contractors', '/parking'],
    },
    {
      label: 'Airfield Management',
      items: ['/discrepancies', '/obstructions', '/obstructions/history', '/waivers', '/infrastructure'],
    },
    {
      label: 'Reference',
      items: ['/aircraft', '/regulations', '/notams', '/reports'],
    },
    {
      label: 'Settings',
      items: ['/settings', '/library', '/users'],
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
