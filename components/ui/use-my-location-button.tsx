'use client'

import { useCallback, useState } from 'react'
import { Crosshair } from 'lucide-react'
import { toast } from 'sonner'

export type UseMyLocationButtonVariant = 'overlay' | 'inline'

type Props = {
  /**
   * 'inline' — full-width cyan button used as a form companion (next to a
   * location-picker map or inside a card).
   * 'overlay' — small chip pinned over the top-right of a map viewport.
   */
  variant: UseMyLocationButtonVariant
  /** Fired when geolocation acquires a position. */
  onLocation: (coords: { lat: number; lng: number; accuracy: number }) => void
  /**
   * Optional — if provided, the button shows a toggle (Use My Location ↔
   * Clear Location). Only the overlay variant uses this today.
   */
  acquired?: boolean
  onClear?: () => void
  /** Optional label override; defaults to "Use My Location". */
  label?: string
  /** Optional className override for parent layout. */
  className?: string
  /**
   * Optional style override merged on top of the variant defaults — use
   * sparingly. Layout-only properties (margin, flex) belong here.
   */
  style?: React.CSSProperties
  /** Disable the button (e.g., while the parent is saving). */
  disabled?: boolean
}

export default function UseMyLocationButton({
  variant,
  onLocation,
  acquired = false,
  onClear,
  label = 'Use My Location',
  className,
  style,
  disabled = false,
}: Props) {
  const [loading, setLoading] = useState(false)

  const handleClick = useCallback(() => {
    if (acquired && onClear) {
      onClear()
      return
    }
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported on this device')
      return
    }
    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        })
        setLoading(false)
        toast.success('Location acquired')
      },
      (error) => {
        setLoading(false)
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error('Location access denied. Enable location permissions and try again.')
            break
          case error.POSITION_UNAVAILABLE:
            toast.error('Location unavailable. Make sure GPS is enabled.')
            break
          case error.TIMEOUT:
            toast.error('Location request timed out. Try again.')
            break
          default:
            toast.error('Unable to get your location')
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }, [acquired, onClear, onLocation])

  const isBusy = loading
  const showClear = acquired && !!onClear
  const text = isBusy
    ? variant === 'overlay' ? 'Locating…' : 'Getting Location…'
    : showClear ? 'Clear Location' : label

  const baseStyle: React.CSSProperties =
    variant === 'overlay'
      ? {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          background: showClear
            ? 'color-mix(in srgb, var(--color-cyan) 22%, rgba(4, 7, 12, 0.88))'
            : 'rgba(4, 7, 12, 0.88)',
          border: `1px solid ${showClear
            ? 'color-mix(in srgb, var(--color-cyan) 55%, transparent)'
            : 'rgba(148, 163, 184, 0.25)'}`,
          borderRadius: 6,
          color: showClear ? 'var(--color-cyan)' : '#CBD5E1',
          fontSize: '11px',
          fontWeight: 700,
          cursor: isBusy ? 'wait' : disabled ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          opacity: isBusy ? 0.6 : 1,
        }
      : {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          width: '100%',
          padding: '10px 16px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid color-mix(in srgb, var(--color-cyan) 35%, transparent)',
          background: 'color-mix(in srgb, var(--color-cyan) 12%, transparent)',
          color: 'var(--color-cyan)',
          fontSize: 'var(--fs-md)',
          fontWeight: 700,
          cursor: isBusy ? 'wait' : disabled ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          opacity: isBusy || disabled ? 0.6 : 1,
        }

  const iconSize = variant === 'overlay' ? 12 : 16

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isBusy || disabled}
      title={showClear ? 'Clear your location' : 'Show my location'}
      className={className}
      style={{ ...baseStyle, ...style }}
    >
      <Crosshair size={iconSize} />
      {text}
    </button>
  )
}
