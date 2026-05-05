// Client-only helper. Renders a lucide-react icon to a static SVG
// string, used by COP markers (Google Maps + Mapbox) that build DOM
// nodes imperatively and need an HTML/SVG string to assign to innerHTML.
//
// Kept out of lib/utils.ts because react-dom/server cannot be imported
// from any module reachable from a Server Component. This module is
// imported only by 'use client' map-view components.

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { LucideIcon } from 'lucide-react'

export function renderLucideToSvgString(
  Icon: LucideIcon,
  { size = 18, color = '#FFFFFF', strokeWidth = 2.25 }: {
    size?: number
    color?: string
    strokeWidth?: number
  } = {},
): string {
  return renderToStaticMarkup(createElement(Icon, { size, color, strokeWidth }))
}
