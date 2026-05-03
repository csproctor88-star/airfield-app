'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Rocket, Search, X, Download, ExternalLink, Compass, Sparkles, CheckCircle2, Circle } from 'lucide-react'
import { toast } from 'sonner'
import { MODULES, type TrainingRole } from '@/lib/training/modules'
import { RoleChipFilter } from '@/components/training/role-chip-filter'
import { ModuleCard } from '@/components/training/module-card'
import { useReviewedModules } from '@/lib/training/use-reviewed'

// Lean Quick Start cluster — 7 steps that hold for any role on day 1.
// Phase 2 will refresh content + screenshots after the modules sweep.
const QUICK_START_STEPS = [
  {
    number: '01',
    title: 'Sign in and pick your installation',
    description:
      'Log in with your credentials. The installation switcher in the sidebar header lets system administrators move between bases; everyone else is scoped to their assigned installation automatically.',
  },
  {
    number: '02',
    title: 'Land on Airfield Status',
    description:
      'Glidepath\'s home screen — live weather, runway open/closed labels, NAVAID color-coded grid, ARFF readiness, and active advisories. This is your shift\'s primary view; keep it open.',
  },
  {
    number: '03',
    title: 'Learn the sidebar',
    description:
      'Operations / Airfield Management / Reference / Settings. The pinned items at top are most-used; use Customize Navigation in the sidebar footer to rearrange. On mobile, the bottom nav has Status / Dashboard / Discrepancies / More.',
  },
  {
    number: '04',
    title: 'Run your shift open',
    description:
      'Open the Shift Checklist and complete pre-shift items. Skim the Daily Reviews queue if you owe a sign-off from yesterday. Note any open discrepancies waiting on you in the sidebar dot.',
  },
  {
    number: '05',
    title: 'Conduct checks and inspections',
    description:
      'Airfield Checks for FOD / RSC / RCR / Weather / BASH (drafts auto-save and resume cross-device). All Inspections for Daily Airfield, Lighting, ACSI, Construction, Joint Monthly. Issues you log auto-route to discrepancies.',
  },
  {
    number: '06',
    title: 'Resolve discrepancies and respond to events',
    description:
      'Discrepancies routes to the right CES shop based on type. Quick Reaction Checklists (QRC) walk you through emergencies step by step, with full audit trail. Events Log captures everything as it happens.',
  },
  {
    number: '07',
    title: 'Generate reports + close out',
    description:
      'Reports & Analytics has 5 PDF reports plus a 30-day analytics dashboard. Sign your shift\'s daily review when complete. Hand off any active QRCs to the next shift; they persist across handoff.',
  },
] as const

type Tab = 'modules' | 'quickstart' | 'basesetup'
type ReviewedFilter = 'all' | 'unreviewed' | 'reviewed'

export default function TrainingPage() {
  const [activeTab, setActiveTab] = useState<Tab>('modules')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<TrainingRole[]>([])
  const [reviewedFilter, setReviewedFilter] = useState<ReviewedFilter>('all')
  const [generating, setGenerating] = useState(false)

  const { isReviewed, reviewed } = useReviewedModules()

  const trimmedQuery = searchQuery.trim().toLowerCase()
  const searching = trimmedQuery.length >= 2

  const filteredModules = useMemo(() => {
    return MODULES.filter(m => {
      if (selectedRoles.length > 0 && !m.roles.some(r => selectedRoles.includes(r))) return false
      if (searching) {
        const hay = `${m.name} ${m.tagline} ${m.overview} ${m.keyFeatures.join(' ')}`.toLowerCase()
        if (!hay.includes(trimmedQuery)) return false
      }
      if (reviewedFilter === 'reviewed' && !isReviewed(m.id)) return false
      if (reviewedFilter === 'unreviewed' && isReviewed(m.id)) return false
      return true
    })
  }, [selectedRoles, searching, trimmedQuery, reviewedFilter, isReviewed])

  const reviewedCount = reviewed.size
  const totalCount = MODULES.length

  async function handleDownloadModulePdf() {
    setGenerating(true)
    try {
      const { generateModuleReferencePdf } = await import('@/lib/training-pdf')
      const data = MODULES.map(m => ({
        name: m.name,
        tagline: m.tagline,
        overview: m.overview,
        keyFeatures: m.keyFeatures,
        howToAccess: m.howToAccess,
        screenshots: m.screenshots,
      }))
      const { doc, filename } = await generateModuleReferencePdf(data)
      doc.save(filename)
      toast.success('Module Reference PDF downloaded')
    } catch {
      toast.error('Failed to generate PDF')
    }
    setGenerating(false)
  }

  return (
    <div className="page-container" style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        paddingBottom: 12,
        marginBottom: 14,
        borderBottom: '1px solid color-mix(in srgb, var(--color-cyan) 25%, transparent)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Rocket size={20} color="var(--color-cyan)" />
          <div>
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>
              Glidepath Training
            </div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
              Module reference + onboarding for using the platform
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDownloadModulePdf}
          disabled={generating}
          style={pdfBtnStyle(generating)}
        >
          <Download size={14} />
          {generating ? 'Generating…' : 'Module Reference PDF'}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        <TabButton active={activeTab === 'modules'} onClick={() => setActiveTab('modules')}>
          <Compass size={14} /> Modules
          <span style={countPillStyle(activeTab === 'modules')}>{MODULES.length}</span>
        </TabButton>
        <TabButton active={activeTab === 'quickstart'} onClick={() => setActiveTab('quickstart')}>
          <Sparkles size={14} /> Quick Start
        </TabButton>
        <TabButton active={activeTab === 'basesetup'} onClick={() => setActiveTab('basesetup')}>
          Base Setup
        </TabButton>
      </div>

      {/* Modules tab */}
      {activeTab === 'modules' && (
        <>
          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <Search
              size={14}
              color="var(--color-text-3)"
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search modules — name, tagline, features…"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 32px 8px 30px',
                background: 'var(--color-search-bg)',
                border: '1px solid var(--color-search-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text-1)',
                fontSize: 'var(--fs-sm)',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-text-3)',
                  padding: 4,
                  display: 'flex',
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Role chip filter */}
          <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={filterLabelStyle}>Filter by role</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <RoleChipFilter selected={selectedRoles} onChange={setSelectedRoles} />
            </div>
          </div>

          {/* Reviewed filter + progress */}
          <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={filterLabelStyle}>Show</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <ReviewedToggle label="All" active={reviewedFilter === 'all'} onClick={() => setReviewedFilter('all')} />
              <ReviewedToggle label="Unreviewed" active={reviewedFilter === 'unreviewed'} onClick={() => setReviewedFilter('unreviewed')} />
              <ReviewedToggle label="Reviewed" active={reviewedFilter === 'reviewed'} onClick={() => setReviewedFilter('reviewed')} />
            </div>
            <span style={{
              marginLeft: 'auto',
              fontSize: 'var(--fs-xs)',
              color: 'var(--color-text-3)',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}>
              <CheckCircle2 size={13} color="var(--color-success)" />
              {reviewedCount} of {totalCount} reviewed
            </span>
          </div>

          {/* Tile grid */}
          {filteredModules.length === 0 ? (
            <div style={{
              padding: 28,
              textAlign: 'center',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-bg-surface)',
              border: '1px dashed var(--color-border)',
              color: 'var(--color-text-3)',
              fontSize: 'var(--fs-sm)',
            }}>
              No modules match the current filter.
              {(searching || selectedRoles.length > 0) && (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setSelectedRoles([]) }}
                  style={{
                    display: 'inline-block',
                    marginLeft: 8,
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-cyan)',
                    cursor: 'pointer',
                    fontSize: 'var(--fs-sm)',
                    fontWeight: 700,
                    fontFamily: 'inherit',
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 10,
            }}>
              {filteredModules.map(m => (
                <ModuleCard key={m.id} module={m} reviewed={isReviewed(m.id)} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Quick Start tab — numbered stepper with vertical connecting line */}
      {activeTab === 'quickstart' && (
        <div style={{
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: '20px 24px',
          position: 'relative',
        }}>
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', position: 'relative' }}>
            {/* Vertical connecting line behind the number badges */}
            <div style={{
              position: 'absolute',
              left: 25,
              top: 24,
              bottom: 24,
              width: 2,
              background: 'color-mix(in srgb, var(--color-cyan) 22%, transparent)',
              borderRadius: 1,
            }} />
            {QUICK_START_STEPS.map((s, i) => (
              <li
                key={s.number}
                style={{
                  position: 'relative',
                  display: 'flex',
                  gap: 18,
                  paddingBottom: i < QUICK_START_STEPS.length - 1 ? 22 : 0,
                }}
              >
                <div style={{
                  width: 52,
                  height: 52,
                  minWidth: 52,
                  borderRadius: '50%',
                  background: 'color-mix(in srgb, var(--color-cyan) 14%, var(--color-bg-surface))',
                  border: '1.5px solid var(--color-cyan)',
                  color: 'var(--color-cyan)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'var(--fs-lg)',
                  fontWeight: 800,
                  letterSpacing: '-0.01em',
                  flexShrink: 0,
                  zIndex: 1,
                  boxShadow: '0 0 0 4px var(--color-bg-surface)',
                }}>
                  {s.number}
                </div>
                <div style={{ flex: 1, paddingTop: 4 }}>
                  <div style={{
                    fontSize: 'var(--fs-lg)',
                    fontWeight: 700,
                    color: 'var(--color-text-1)',
                    marginBottom: 6,
                    lineHeight: 1.3,
                  }}>
                    {s.title}
                  </div>
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', lineHeight: 1.6 }}>
                    {s.description}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Base Setup tab — placeholder for now; the live wizard at /base-config/setup is the source of truth */}
      {activeTab === 'basesetup' && (
        <div style={{
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: 24,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 8 }}>
            Base Setup walkthrough
          </div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', lineHeight: 1.55, marginBottom: 16, maxWidth: 540, margin: '0 auto 16px' }}>
            The live Base Setup wizard at <strong>/base-config/setup</strong> walks system and base administrators through 16
            short steps — runways, NAVAIDs, ARFF, QRC templates, the works — with a guided in-page tour the first time it&apos;s
            opened. Visit it directly for the source-of-truth flow. A refreshed reference walkthrough lands here in a future
            update.
          </div>
          <Link
            href="/base-config/setup"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'color-mix(in srgb, var(--color-cyan) 14%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-cyan) 35%, transparent)',
              color: 'var(--color-cyan)',
              fontSize: 'var(--fs-sm)',
              fontWeight: 700,
              textDecoration: 'none',
              fontFamily: 'inherit',
            }}
          >
            Open Base Setup wizard <ExternalLink size={14} />
          </Link>
        </div>
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 14px',
        borderRadius: 'var(--radius-md)',
        border: active ? '1px solid var(--color-cyan)' : '1px solid var(--color-border)',
        background: active
          ? 'color-mix(in srgb, var(--color-cyan) 14%, var(--color-bg-surface))'
          : 'var(--color-bg-inset)',
        color: active ? 'var(--color-cyan)' : 'var(--color-text-2)',
        fontSize: 'var(--fs-sm)',
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'background 0.15s',
      }}
    >
      {children}
    </button>
  )
}

function ReviewedToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 10px',
        borderRadius: 999,
        border: active ? '1px solid var(--color-cyan)' : '1px solid var(--color-border)',
        background: active ? 'color-mix(in srgb, var(--color-cyan) 14%, transparent)' : 'var(--color-bg-surface)',
        color: active ? 'var(--color-cyan)' : 'var(--color-text-2)',
        fontSize: 'var(--fs-xs)',
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {active && label !== 'All' && <Circle size={9} fill="currentColor" strokeWidth={0} />}
      {label}
    </button>
  )
}

const filterLabelStyle: React.CSSProperties = {
  fontSize: 'var(--fs-2xs)',
  fontWeight: 800,
  color: 'var(--color-text-3)',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  flexShrink: 0,
}

function pdfBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-bg-surface)',
    color: 'var(--color-text-2)',
    fontSize: 'var(--fs-xs)',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    cursor: disabled ? 'wait' : 'pointer',
    fontFamily: 'inherit',
    opacity: disabled ? 0.6 : 1,
  }
}

function countPillStyle(active: boolean): React.CSSProperties {
  return {
    fontSize: 'var(--fs-2xs)',
    fontWeight: 800,
    padding: '1px 6px',
    borderRadius: 9,
    background: active ? 'color-mix(in srgb, var(--color-cyan) 22%, transparent)' : 'var(--color-bg-elevated)',
    color: active ? 'var(--color-cyan)' : 'var(--color-text-3)',
    minWidth: 18,
    textAlign: 'center' as const,
  }
}

