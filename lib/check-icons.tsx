// Lucide icon name → component lookup for type configs in
// `lib/constants.ts` (CHECK_TYPE_CONFIG, INSPECTION_TYPE_CONFIG).
// The configs store Lucide component *names* as strings so the
// constants file stays free of React imports — it gets pulled into
// PDF generators, draft serializers, and analytics that run outside
// React.

import {
  Search,
  CloudRain,
  Siren,
  Truck,
  Plane,
  PlaneTakeoff,
  Bird,
  HardHat,
  Handshake,
  ClipboardList,
  Lightbulb,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'

const ICON_MAP: Record<string, LucideIcon> = {
  // Check types
  Search,
  CloudRain,
  Siren,
  Truck,
  Plane,
  Bird,
  HardHat,
  ClipboardList,
  // Inspection types
  PlaneTakeoff,
  Lightbulb,
  Handshake,
  ShieldCheck,
}

/** Returns the Lucide component for a TYPE_CONFIG icon name string.
 *  Falls back to `ClipboardList` if the name is unknown so the UI
 *  always renders something. Shared by CHECK_TYPE_CONFIG and
 *  INSPECTION_TYPE_CONFIG. */
export function getTypeIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? ClipboardList
}

/** Backwards-compatible re-export so existing /checks call sites
 *  keep working while the rename rolls through. */
export const getCheckIcon = getTypeIcon
