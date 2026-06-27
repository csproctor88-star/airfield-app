'use client'

import { useState } from 'react'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import { useDashboard } from '@/lib/dashboard-context'
import { logManualEntry } from '@/lib/supabase/activity'
import { toast } from 'sonner'
import { DoorOpen, AlertOctagon, Moon } from 'lucide-react'

const OOO_DEFAULT = 'Airfield Management is Out of the Office. Contact via cell phone at (586) 396-4046 or via Tower Net Callsign: Airfield3'
const CLOSED_DEFAULT = 'Airfield Management is CLOSED for the day. Runway, RSC, and BWC status will be refreshed during the next opening check.'

export function AfmTogglesWidget() {
  const { installationId, defaultOooMessage, updateDefaultOooMessage, defaultClosedMessage, updateDefaultClosedMessage } = useInstallation()
  const { afmOutOfOffice, afmOooMessage, setAfmOutOfOffice, afmClosed, afmClosedMessage, setAfmClosed } = useDashboard()
  const { has } = usePermissions()
  const canToggle = has(PERM.AIRFIELD_STATUS_WRITE)

  // OOO dialog state
  const [showOoo, setShowOoo] = useState(false)
  const [showOooDeactivate, setShowOooDeactivate] = useState(false)
  const [oooMsg, setOooMsg] = useState(OOO_DEFAULT)
  const [savingOooDefault, setSavingOooDefault] = useState(false)

  // Closed dialog state
  const [showClosed, setShowClosed] = useState(false)
  const [showClosedDeactivate, setShowClosedDeactivate] = useState(false)
  const [closedMsg, setClosedMsg] = useState(CLOSED_DEFAULT)
  const [savingClosedDefault, setSavingClosedDefault] = useState(false)

  if (!canToggle) {
    return (
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
        Requires Airfield Status write permission.
      </div>
    )
  }

  const btnBase: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
    padding: '10px 8px', borderRadius: 'var(--radius-md)', minHeight: 68,
    fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    textAlign: 'center', lineHeight: 1.2, flex: 1,
  }

  const cancelBtn: React.CSSProperties = {
    flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700,
    cursor: 'pointer', border: '1px solid var(--color-border-mid)',
    background: 'var(--color-bg-inset)', color: 'var(--color-text-3)',
    fontFamily: 'inherit',
  }

  const textareaStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 'var(--radius-md)',
    background: 'var(--color-bg-inset)', border: '1px solid var(--color-border-mid)',
    color: 'var(--color-text-1)', fontSize: 'var(--fs-lg)', outline: 'none',
    fontFamily: 'inherit', resize: 'vertical', minHeight: 60, marginBottom: 8,
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 8, height: '100%' }}>
        {/* Out of Office */}
        <button
          onClick={() => {
            if (afmOutOfOffice) {
              setShowOooDeactivate(true)
            } else {
              setOooMsg(afmOooMessage || defaultOooMessage || OOO_DEFAULT)
              setShowOoo(true)
            }
          }}
          style={{
            ...btnBase,
            background: afmOutOfOffice
              ? 'color-mix(in srgb, var(--color-cyan) 10%, transparent)'
              : 'var(--color-bg-surface)',
            border: afmOutOfOffice
              ? '1px solid color-mix(in srgb, var(--color-cyan) 40%, transparent)'
              : '1px solid var(--color-border)',
            borderLeft: afmOutOfOffice ? '2px solid var(--color-cyan)' : '1px solid var(--color-border)',
            color: afmOutOfOffice ? 'var(--color-cyan)' : 'var(--color-text-1)',
          }}
        >
          <DoorOpen size={22} color={afmOutOfOffice ? 'var(--color-cyan)' : 'var(--color-text-2)'} strokeWidth={2.25} />
          <span>{afmOutOfOffice ? 'End Out of Office' : 'Out of Office'}</span>
        </button>

        {/* Close Airfield */}
        <button
          onClick={() => {
            if (afmClosed) {
              setShowClosedDeactivate(true)
            } else {
              setClosedMsg(afmClosedMessage || defaultClosedMessage || CLOSED_DEFAULT)
              setShowClosed(true)
            }
          }}
          style={{
            ...btnBase,
            background: afmClosed
              ? 'color-mix(in srgb, var(--color-danger) 10%, transparent)'
              : 'var(--color-bg-surface)',
            border: afmClosed
              ? '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)'
              : '1px solid var(--color-border)',
            borderLeft: afmClosed ? '4px solid var(--color-danger)' : '1px solid var(--color-border)',
            color: afmClosed ? 'var(--color-danger)' : 'var(--color-text-1)',
          }}
        >
          {afmClosed
            ? <AlertOctagon size={22} color="var(--color-danger)" strokeWidth={2.5} />
            : <Moon size={22} color="var(--color-text-2)" strokeWidth={2.25} />}
          <span>{afmClosed ? 'Reopen Airfield' : 'Close Airfield'}</span>
        </button>
      </div>

      {/* ── OOO Activate dialog ── */}
      {showOoo && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowOoo(false) }} style={{ padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: 'var(--color-bg-surface-solid)', borderRadius: 'var(--radius-lg)', padding: 24,
            width: '100%', maxWidth: 440, border: '1px solid var(--color-border-mid)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <DoorOpen size={22} color="var(--color-accent)" strokeWidth={2.25} />
              <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>Out of Office</div>
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 12 }}>
              This message will display as a full-screen overlay on the Airfield Status page for all users.
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)', marginBottom: 4 }}>Display Message</div>
            <textarea value={oooMsg} onChange={(e) => setOooMsg(e.target.value)} rows={3} style={textareaStyle} />
            <div style={{ marginBottom: 14 }}>
              <button
                type="button"
                onClick={async () => {
                  const msg = oooMsg.trim()
                  if (!msg) return
                  setSavingOooDefault(true)
                  try {
                    await updateDefaultOooMessage(msg)
                    toast.success('Default message saved for this base')
                  } catch {
                    toast.error('Could not save default message')
                  } finally {
                    setSavingOooDefault(false)
                  }
                }}
                disabled={savingOooDefault || !oooMsg.trim() || oooMsg.trim() === (defaultOooMessage || '').trim()}
                style={{
                  padding: '6px 12px', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-sm)', fontWeight: 600,
                  cursor: savingOooDefault ? 'default' : 'pointer',
                  border: '1px solid var(--color-border-mid)',
                  background: 'var(--color-bg-inset)', color: 'var(--color-text-2)',
                  opacity: (!oooMsg.trim() || oooMsg.trim() === (defaultOooMessage || '').trim()) ? 0.5 : 1,
                  fontFamily: 'inherit',
                }}
              >{savingOooDefault ? 'Saving…' : 'Set as Default'}</button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={async () => {
                  await setAfmOutOfOffice(true, oooMsg)
                  await logManualEntry('AMOPS out of office, Command Post notified', installationId)
                  setShowOoo(false)
                  toast.success('Out of Office activated')
                }}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700,
                  cursor: 'pointer', border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)',
                  background: 'color-mix(in srgb, var(--color-danger) 15%, transparent)', color: 'var(--color-danger)', fontFamily: 'inherit',
                }}
              >Activate</button>
              <button onClick={() => setShowOoo(false)} style={{ ...cancelBtn }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── OOO Deactivate dialog ── */}
      {showOooDeactivate && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowOooDeactivate(false) }} style={{ padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: 'var(--color-bg-surface-solid)', borderRadius: 'var(--radius-lg)', padding: 24,
            width: '100%', maxWidth: 380, border: '1px solid var(--color-border-mid)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <DoorOpen size={22} color="var(--color-accent)" strokeWidth={2.25} />
              <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>End Out of Office</div>
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 16 }}>
              This will clear the Out of Office overlay and log a Command Post notification in the events log.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={async () => {
                  await setAfmOutOfOffice(false)
                  await logManualEntry('AMOPS back in office, Command Post notified', installationId)
                  setShowOooDeactivate(false)
                  toast.success('Out of Office deactivated')
                }}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700,
                  cursor: 'pointer', border: '1px solid var(--color-success)',
                  background: 'color-mix(in srgb, var(--color-success) 15%, transparent)', color: 'var(--color-success)', fontFamily: 'inherit',
                }}
              >Deactivate</button>
              <button onClick={() => setShowOooDeactivate(false)} style={{ ...cancelBtn }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Close Airfield dialog ── */}
      {showClosed && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowClosed(false) }} style={{ padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: 'var(--color-bg-surface-solid)', borderRadius: 'var(--radius-lg)', padding: 24,
            width: '100%', maxWidth: 460, border: '1px solid var(--color-border-mid)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <AlertOctagon size={22} color="var(--color-danger)" strokeWidth={2.5} />
              <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>Close Airfield Management</div>
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 12, lineHeight: 1.55 }}>
              Displays a CLOSED banner on the Airfield Status page and{' '}
              <strong style={{ color: 'var(--color-text-2)' }}>resets runway status, RSC, RCR, and BWC</strong> so tomorrow&rsquo;s opening check can enter fresh values.
              Historical entries in the Events Log are not affected.
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)', marginBottom: 4 }}>Display Message</div>
            <textarea value={closedMsg} onChange={(e) => setClosedMsg(e.target.value)} rows={3} style={textareaStyle} />
            <div style={{ marginBottom: 14 }}>
              <button
                type="button"
                onClick={async () => {
                  const msg = closedMsg.trim()
                  if (!msg) return
                  setSavingClosedDefault(true)
                  try {
                    await updateDefaultClosedMessage(msg)
                    toast.success('Default message saved for this base')
                  } catch {
                    toast.error('Could not save default message')
                  } finally {
                    setSavingClosedDefault(false)
                  }
                }}
                disabled={savingClosedDefault || !closedMsg.trim() || closedMsg.trim() === (defaultClosedMessage || '').trim()}
                style={{
                  padding: '6px 12px', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-sm)', fontWeight: 600,
                  cursor: savingClosedDefault ? 'default' : 'pointer',
                  border: '1px solid var(--color-border-mid)',
                  background: 'var(--color-bg-inset)', color: 'var(--color-text-2)',
                  opacity: (!closedMsg.trim() || closedMsg.trim() === (defaultClosedMessage || '').trim()) ? 0.5 : 1,
                  fontFamily: 'inherit',
                }}
              >{savingClosedDefault ? 'Saving…' : 'Set as Default'}</button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={async () => {
                  await setAfmClosed(true, closedMsg)
                  await logManualEntry('AMOPS Closed. Command Post notified.', installationId)
                  setShowClosed(false)
                  toast.success('Airfield management closed')
                }}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700,
                  cursor: 'pointer', border: '1px solid var(--color-danger)',
                  background: 'var(--color-danger)', color: '#fff', fontFamily: 'inherit',
                }}
              >Close Airfield</button>
              <button onClick={() => setShowClosed(false)} style={{ ...cancelBtn }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reopen dialog ── */}
      {showClosedDeactivate && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowClosedDeactivate(false) }} style={{ padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: 'var(--color-bg-surface-solid)', borderRadius: 'var(--radius-lg)', padding: 24,
            width: '100%', maxWidth: 380, border: '1px solid var(--color-border-mid)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <AlertOctagon size={22} color="var(--color-danger)" strokeWidth={2.5} />
              <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>End Closed Status</div>
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 16, lineHeight: 1.55 }}>
              This will clear the CLOSED banner. Runway, RSC, and BWC values remain blank — enter fresh values during the opening check.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={async () => {
                  await setAfmClosed(false)
                  await logManualEntry('AMOPS Open. Command Post notified.', installationId)
                  setShowClosedDeactivate(false)
                  toast.success('Closed status ended')
                }}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', fontWeight: 700,
                  cursor: 'pointer', border: '1px solid var(--color-success)',
                  background: 'color-mix(in srgb, var(--color-success) 15%, transparent)', color: 'var(--color-success)', fontFamily: 'inherit',
                }}
              >Deactivate</button>
              <button onClick={() => setShowClosedDeactivate(false)} style={{ ...cancelBtn }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
