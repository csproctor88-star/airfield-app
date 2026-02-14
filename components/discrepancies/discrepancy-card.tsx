'use client'

import Link from 'next/link'
import { StatusBadge } from '@/components/ui/badge'
import { Camera } from 'lucide-react'

// Discrepancy card matching prototype: left border accent, ID in cyan, badges, location line

interface DiscrepancyCardProps {
  id: string
  displayId: string
  title: string
  severity?: string
  status: string
  locationText: string
  assignedShop: string | null
  daysOpen: number
  photoCount: number
  workOrderNumber?: string | null
}

export function DiscrepancyCard({
  id,
  displayId,
  title,
  status,
  locationText,
  assignedShop,
  daysOpen,
  photoCount,
  workOrderNumber,
}: DiscrepancyCardProps) {

  return (
    <Link
      href={`/discrepancies/${id}`}
      className="card"
      style={{
        cursor: 'pointer',
        display: 'block',
        marginBottom: 8,
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#22D3EE', fontFamily: 'monospace' }}>
          {workOrderNumber || 'Pending'}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <StatusBadge status={status} />
        </div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: 10, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>{locationText}</span>
        <span>&bull;</span>
        <span>{assignedShop || 'Unassigned'}</span>
        <span>&bull;</span>
        <span>{`${daysOpen}d open`}</span>
        {photoCount > 0 && (
          <>
            <span>&bull;</span>
            <Camera size={10} />
            <span>{photoCount}</span>
          </>
        )}
      </div>
    </Link>
  )
}
