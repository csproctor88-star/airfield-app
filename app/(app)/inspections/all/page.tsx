'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useInstallation } from '@/lib/installation-context'
import { createClient } from '@/lib/supabase/client'
import { fetchAcsiInspections } from '@/lib/supabase/acsi-inspections'
import type { AcsiInspection } from '@/lib/supabase/types'

export default function AllInspectionsPage() {
  const router = useRouter()
  const { installationId } = useInstallation()
  const [acsiDraft, setAcsiDraft] = useState<AcsiInspection | null>(null)
  const [loaded, setLoaded] = useState(false)

  // Check for most recent ACSI draft/in-progress
  useEffect(() => {
    async function checkAcsiDraft() {
      const supabase = createClient()
      if (!supabase || !installationId) {
        setLoaded(true)
        return
      }
      const all = await fetchAcsiInspections(installationId)
      const draft = all.find(a => a.status === 'draft' || a.status === 'in_progress')
      if (draft) setAcsiDraft(draft)
      setLoaded(true)
    }
    checkAcsiDraft()
  }, [installationId])

  const handleAcsiStart = () => {
    if (acsiDraft) {
      router.push(`/acsi/${acsiDraft.id}`)
    } else {
      router.push('/acsi/new')
    }
  }

  const INSPECTION_TYPES = [
    {
      label: 'Daily Airfield Inspection',
      icon: '✈️',
      color: '#10B981',
      description: 'DAFI 13-213 daily airfield & lighting inspections',
      href: '/inspections?action=begin',
      actionLabel: 'Start Daily Inspection',
      historyHref: '/inspections?view=history',
    },
    {
      label: 'Airfield Compliance and Safety Inspection',
      icon: '🛡️',
      color: '#8B5CF6',
      description: 'DAFMAN 13-204v2, Para 5.4.3 annual compliance inspection',
      href: null, // handled by handleAcsiStart
      actionLabel: acsiDraft ? 'Continue ACSI Draft' : 'Start ACSI',
      historyHref: '/acsi',
      onClick: handleAcsiStart,
    },
    {
      label: 'Pre/Post Construction',
      icon: '🏗️',
      color: '#F59E0B',
      description: 'Construction zone safety coordination inspections',
      href: '/inspections?action=begin&type=construction_meeting',
      actionLabel: 'Start Pre/Post Construction Inspection',
      historyHref: '/inspections?view=history',
    },
    {
      label: 'Monthly Joint Inspection',
      icon: '🤝',
      color: '#3B82F6',
      description: 'Monthly joint airfield inspection with CE & Safety',
      href: '/inspections?action=begin&type=joint_monthly',
      actionLabel: 'Start Joint Monthly Inspection',
      historyHref: '/inspections?view=history',
    },
  ]

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Header */}
      <div style={{ width: '100%', maxWidth: 600 }}>
        <Link href="/more" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          color: 'var(--color-text-3)', textDecoration: 'none', fontSize: 'var(--fs-sm)', marginBottom: 12,
        }}>
          <ArrowLeft size={14} /> Back to More
        </Link>

        <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, marginBottom: 4 }}>
          All Inspections
        </div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 20 }}>
          Start a new inspection or view history
        </div>
      </div>

      {/* Inspection type cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 600 }}>
        {INSPECTION_TYPES.map((type) => (
          <div
            key={type.label}
            style={{
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            {/* Card header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px',
              borderBottom: '1px solid var(--color-border)',
            }}>
              <div
                style={{
                  width: 48, height: 48, minWidth: 48,
                  borderRadius: 10,
                  background: `${type.color}14`,
                  border: `1px solid ${type.color}33`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 'var(--fs-2xl)',
                }}
              >
                {type.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: type.color }}>
                  {type.label}
                </div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2, lineHeight: 1.4 }}>
                  {type.description}
                </div>
              </div>
            </div>

            {/* Actions row */}
            <div style={{
              display: 'flex', gap: 8, padding: '10px 16px', justifyContent: 'center',
            }}>
              {type.onClick ? (
                <button
                  onClick={type.onClick}
                  disabled={!loaded}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 8,
                    textAlign: 'center',
                    background: `${type.color}18`,
                    border: `1px solid ${type.color}33`,
                    color: type.color,
                    fontSize: 'var(--fs-sm)',
                    fontWeight: 700,
                    cursor: loaded ? 'pointer' : 'default',
                    opacity: loaded ? 1 : 0.6,
                    fontFamily: 'inherit',
                  }}
                >
                  + {type.actionLabel}
                </button>
              ) : (
                <Link
                  href={type.href!}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 8,
                    textAlign: 'center',
                    background: `${type.color}18`,
                    border: `1px solid ${type.color}33`,
                    color: type.color,
                    fontSize: 'var(--fs-sm)',
                    fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  + {type.actionLabel}
                </Link>
              )}
              <Link
                href={type.historyHref}
                style={{
                  padding: '10px 16px',
                  borderRadius: 8,
                  textAlign: 'center',
                  background: 'var(--color-bg-sunken)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-2)',
                  fontSize: 'var(--fs-sm)',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                History
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
