'use client'

import { useParams } from 'next/navigation'
import { PublicPprRequestForm } from '@/components/ppr/public-request-form'

/** Short, base-aware PPR request URL: /<icao>/ppr-request.
 *  Resolves the ICAO via SECURITY DEFINER RPC; no auth required. */
export default function IcaoPprRequestPage() {
  const { icao } = useParams<{ icao: string }>()
  return <PublicPprRequestForm lookup={{ kind: 'icao', value: icao }} />
}
