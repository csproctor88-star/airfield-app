'use client'

import { useParams } from 'next/navigation'
import { PublicPprRequestForm } from '@/components/ppr/public-request-form'

/** Legacy UUID-based PPR request URL. Kept so QR codes already in
 *  print continue to work. New QRs prefer /[icao]/ppr-request. */
export default function PprRequestPage() {
  const { baseId } = useParams<{ baseId: string }>()
  return <PublicPprRequestForm lookup={{ kind: 'baseId', value: baseId }} />
}
