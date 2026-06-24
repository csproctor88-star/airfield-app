// components/flip/review-signoff.tsx
'use client'

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { getWriteQueue } from '@/lib/sync/write-queue'
import { canSignSlot, SLOT_ORDER, SLOT_LABELS, type FlipRole, type FlipSignSlot, type SignoffState } from '@/lib/flip/roles'
import type { FlipSignoff } from '@/lib/supabase/flip'
import type { FlipReviewSignPayload, FlipReviewSignResult } from '@/lib/sync/handlers'

export function ReviewSignoff({ reviewId, baseId, userId, signoff, myRoles, onSigned }: {
  reviewId: string; baseId: string; userId: string
  signoff: FlipSignoff | null; myRoles: FlipRole[]; onSigned: () => void
}) {
  const [busy, setBusy] = useState<FlipSignSlot | null>(null)
  const state: SignoffState = {
    custodian_signed_at: signoff?.custodian_signed_at ?? null,
    namo_signed_at: signoff?.namo_signed_at ?? null,
    afm_signed_at: signoff?.afm_signed_at ?? null,
  }

  const sign = async (slot: FlipSignSlot) => {
    setBusy(slot)
    try {
      const res = await getWriteQueue().enqueueOrExecute<FlipReviewSignPayload, FlipReviewSignResult>(
        'flip_review_sign', { reviewId, slot }, { baseId, userId, optimisticEntityId: reviewId },
      )
      if (res.status === 'queued') toast.success('Signature queued — will commit when online')
      else toast.success('Signed')
      onSigned()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sign failed')
    } finally { setBusy(null) }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, padding: '14px 16px', borderTop: '1px solid var(--color-border)' }}>
      {SLOT_ORDER.map((slot) => {
        const at = state[`${slot}_signed_at` as keyof SignoffState]
        const locked = !!at
        const canSign = !locked && canSignSlot(myRoles, slot, state)
        return (
          <div key={slot} style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ background: 'var(--color-bg-inset)', padding: '6px 10px', fontSize: 'var(--fs-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-2)' }}>{SLOT_LABELS[slot]}</div>
            <div style={{ padding: 10 }}>
              {locked ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-success)', fontSize: 'var(--fs-sm)' }}>
                  <CheckCircle2 size={16} /> Signed {at?.slice(0, 16).replace('T', ' ')}Z
                </div>
              ) : canSign ? (
                <button onClick={() => sign(slot)} disabled={busy === slot}
                  style={{ width: '100%', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 6, padding: 7, cursor: 'pointer', fontSize: 'var(--fs-sm)' }}>
                  {busy === slot ? 'Signing…' : 'Sign'}
                </button>
              ) : (
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', textAlign: 'center', padding: 4 }}>
                  {slot === 'custodian' ? 'Awaiting custodian' : state[slot === 'namo' ? 'custodian_signed_at' : 'namo_signed_at'] ? 'Not your role' : 'Awaiting prior signature'}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
