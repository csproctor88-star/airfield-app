'use client'

// Persistent AMTR module bar. Rendered by the /amtr layout so Help, Training
// References, and Admin are reachable from every page in the module (roster,
// member record, inspection, reports, admin). Help and References open as
// overlays so they work regardless of the current route.

import { useState } from 'react'
import Link from 'next/link'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import { HowToGuide } from '@/components/amtr/how-to-guide'
import { TrainingReferences } from '@/components/amtr/training-references'
import { Btn } from '@/components/amtr/ui'
import { Award, BookOpen, HelpCircle, UsersRound, X } from 'lucide-react'

export const AMTR_BAR_HEIGHT = 48

const adminLinkStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px',
  borderRadius: 6, fontSize: 'var(--fs-sm)', fontWeight: 600,
  border: '1.5px solid var(--color-border-mid)', color: 'var(--color-text-1)', textDecoration: 'none',
}

export function AmtrModuleBar() {
  const { installationId } = useInstallation()
  const { has } = usePermissions()
  const canManage = has(PERM.AMTR_MANAGE)
  const canView = has(PERM.AMTR_VIEW)
  const [overlay, setOverlay] = useState<'help' | 'refs' | null>(null)

  if (!canView) return null

  return (
    <>
      <div style={{
        height: AMTR_BAR_HEIGHT, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 24px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-elevated)',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <Link href="/amtr" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--color-text-1)', textDecoration: 'none', fontWeight: 600, fontSize: 'var(--fs-sm)' }}>
          <Award size={16} style={{ color: 'var(--color-accent)' }} /> Training Records
        </Link>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn variant={overlay === 'help' ? 'primary' : 'secondary'} onClick={() => setOverlay((o) => (o === 'help' ? null : 'help'))}><HelpCircle size={15} /> Help</Btn>
          <Btn variant={overlay === 'refs' ? 'primary' : 'secondary'} onClick={() => setOverlay((o) => (o === 'refs' ? null : 'refs'))}><BookOpen size={15} /> Training References</Btn>
          {canManage && <Link href="/amtr/roles" style={adminLinkStyle}><UsersRound size={15} /> Admin</Link>}
        </div>
      </div>

      {overlay && (
        <div onClick={() => setOverlay(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflow: 'auto' }}>
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: overlay === 'help' ? 760 : 920, maxWidth: '100%', padding: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
              {overlay === 'help' ? <HelpCircle size={16} style={{ color: 'var(--color-accent)' }} /> : <BookOpen size={16} style={{ color: 'var(--color-accent)' }} />}
              <strong style={{ fontSize: 15 }}>{overlay === 'help' ? 'How the training record works' : 'Training References'}</strong>
              <button onClick={() => setOverlay(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)' }}><X size={18} /></button>
            </div>
            <div style={{ padding: 18 }}>
              {overlay === 'help' ? <HowToGuide /> : <TrainingReferences installationId={installationId} canManage={canManage} />}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
