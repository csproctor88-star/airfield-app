// components/flip/reviews-panel.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronRight, ClipboardPlus, FileDown } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import {
  fetchFlipReviews, fetchFlipReviewItems, fetchFlipSignoffs, fetchFlipList, fetchFlipRoleAssignments,
  type FlipReview, type FlipReviewItem, type FlipSignoff, type FlipListItem,
} from '@/lib/supabase/flip'
import { DocumentReviewModal } from '@/components/flip/document-review-modal'
import { ReviewSignoff } from '@/components/flip/review-signoff'
import { nextSlot, type FlipRole } from '@/lib/flip/roles'
import { generateFlipReviewPdf } from '@/lib/flip-pdf'

export function ReviewsPanel({ baseId, canWrite }: { baseId: string; canWrite: boolean }) {
  const [reviews, setReviews] = useState<FlipReview[]>([])
  const [signoffs, setSignoffs] = useState<FlipSignoff[]>([])
  const [flipList, setFlipList] = useState<FlipListItem[]>([])
  const [itemsByReview, setItemsByReview] = useState<Record<string, FlipReviewItem[]>>({})
  const [openId, setOpenId] = useState<string | null>(null)
  const [myRoles, setMyRoles] = useState<FlipRole[]>([])
  const [userId, setUserId] = useState('')
  const [modal, setModal] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } }
    setUserId(user?.id ?? '')
    const [rv, so, fl, roles] = await Promise.all([
      fetchFlipReviews(baseId), fetchFlipSignoffs(baseId), fetchFlipList(baseId), fetchFlipRoleAssignments(baseId),
    ])
    setReviews(rv); setSignoffs(so); setFlipList(fl)
    setMyRoles(roles.filter((r) => r.user_id === user?.id).map((r) => r.role))
  }, [baseId])

  useEffect(() => { load() }, [load])

  const expand = async (id: string) => {
    if (openId === id) { setOpenId(null); return }
    setOpenId(id)
    if (!itemsByReview[id]) {
      const items = await fetchFlipReviewItems(id)
      setItemsByReview((m) => ({ ...m, [id]: items }))
    }
  }

  const signoffFor = (rid: string) => signoffs.find((s) => s.review_id === rid) ?? null
  const sigStatus = (rid: string) => {
    const so = signoffFor(rid)
    const ns = nextSlot({ custodian_signed_at: so?.custodian_signed_at ?? null, namo_signed_at: so?.namo_signed_at ?? null, afm_signed_at: so?.afm_signed_at ?? null })
    return ns === null ? 'Fully signed' : 'Unsigned'
  }

  const exportPdf = async (rv: FlipReview) => {
    const items = itemsByReview[rv.id] ?? await fetchFlipReviewItems(rv.id)
    const { doc, filename } = generateFlipReviewPdf({ review: rv, items, signoff: signoffFor(rv.id) })
    doc.save(filename)
    toast.success('PDF generated')
  }

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        {canWrite && <button onClick={() => setModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 999, border: 'none', background: 'var(--color-accent)', color: '#fff', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}><ClipboardPlus size={14} /> Document FLIP Review</button>}
      </div>

      <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-3)', marginBottom: 8 }}>Completed Reviews</div>
      {reviews.length === 0 && <p style={{ color: 'var(--color-text-3)', fontStyle: 'italic', fontSize: 'var(--fs-sm)' }}>No reviews documented yet.</p>}

      {reviews.map((rv) => {
        const items = itemsByReview[rv.id] ?? []
        const discCount = items.filter((i) => i.discrepancy).length
        return (
          <div key={rv.id} style={{ border: '1px solid var(--color-border)', borderLeft: '3px solid var(--color-success)', borderRadius: 10, marginBottom: 10, overflow: 'hidden', background: 'var(--color-bg-surface)' }}>
            <div onClick={() => expand(rv.id)} style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
              {openId === rv.id ? <ChevronDown size={16} style={{ color: 'var(--color-text-3)' }} /> : <ChevronRight size={16} style={{ color: 'var(--color-text-3)' }} />}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 'var(--fs-sm)' }}>{rv.cycle}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>{rv.review_date}{openId === rv.id && items.length ? ` · ${items.length} FLIPs · ${discCount} discrepanc${discCount === 1 ? 'y' : 'ies'}` : ''}</div>
              </div>
              <span style={{ fontSize: 'var(--fs-xs)', color: sigStatus(rv.id) === 'Fully signed' ? 'var(--color-success)' : 'var(--color-text-3)' }}>{sigStatus(rv.id)}</span>
            </div>
            {openId === rv.id && (
              <div style={{ borderTop: '1px solid var(--color-border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-xs)' }}>
                  <thead><tr style={{ background: 'var(--color-bg-inset)' }}>
                    {['FLIP Title', 'Effective', 'Disc.', 'Discrepancy', 'Corrective Action', 'Date Corrected'].map((h) => <th key={h} style={{ textAlign: 'left', padding: '7px 10px', fontWeight: 700, color: 'var(--color-text-2)' }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '7px 10px' }}>{it.flip_title}</td>
                        <td style={{ padding: '7px 10px' }}>{it.effective_date ?? '—'}</td>
                        <td style={{ padding: '7px 10px', color: it.discrepancy ? 'var(--color-danger)' : 'var(--color-success)', fontWeight: 600 }}>{it.discrepancy ? 'Yes' : 'No'}</td>
                        <td style={{ padding: '7px 10px' }}>{it.discrepancy_note ?? '—'}</td>
                        <td style={{ padding: '7px 10px' }}>{it.corrective_action ?? '—'}</td>
                        <td style={{ padding: '7px 10px' }}>{it.date_corrected ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <ReviewSignoff reviewId={rv.id} baseId={baseId} userId={userId} signoff={signoffFor(rv.id)} myRoles={myRoles} onSigned={load} />
                <div style={{ padding: '10px 16px', borderTop: '1px solid var(--color-border)' }}>
                  <button onClick={() => exportPdf(rv)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)' }}><FileDown size={14} /> Export Review PDF</button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      <DocumentReviewModal baseId={baseId} flipList={flipList} open={modal} onClose={() => setModal(false)} onCreated={load} />
    </>
  )
}
