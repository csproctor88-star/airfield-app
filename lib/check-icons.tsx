// Lucide icon name → component lookup for the check-type config in
// `lib/constants.ts`. The config stores Lucide component *names* as
// strings so `lib/constants.ts` stays free of React imports (it gets
// pulled into PDF generators, draft serializers, and analytics that
// run outside React).

import {
  Search,
  CloudRain,
  Siren,
  Truck,
  Plane,
  Bird,
  HardHat,
  ClipboardList,
  type LucideIcon,
} from 'lucide-react'

const ICON_MAP: Record<string, LucideIcon> = {
  Search,
  CloudRain,
  Siren,
  Truck,
  Plane,
  Bird,
  HardHat,
  ClipboardList,
}

/** Returns the Lucide component for a CHECK_TYPE_CONFIG icon name.
 *  Falls back to `ClipboardList` if the name is unknown so the UI
 *  always renders something. */
export function getCheckIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? ClipboardList
}
