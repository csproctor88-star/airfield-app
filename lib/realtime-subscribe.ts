import { toast } from 'sonner'
import type { RealtimeChannel } from '@supabase/supabase-js'

let hasShownError = false
let errorResetTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Subscribe to a Supabase Realtime channel with error handling.
 * Shows a toast when the connection fails or times out.
 * Deduplicates error toasts so users don't get spammed.
 */
export function subscribeWithErrorHandling(channel: RealtimeChannel): RealtimeChannel {
  return channel.subscribe((status, err) => {
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      if (!hasShownError) {
        hasShownError = true
        toast.error('Real-time update failed. The server may be temporarily unavailable — try again shortly.', {
          id: 'realtime-error',
          duration: 8000,
        })
        // Reset the flag after 60s so if it keeps failing, we show again
        if (errorResetTimer) clearTimeout(errorResetTimer)
        errorResetTimer = setTimeout(() => { hasShownError = false }, 60000)
      }
      console.warn(`[Realtime] Channel ${status}:`, err?.message || 'unknown error')
    }

    if (status === 'SUBSCRIBED') {
      // If we previously showed an error and now reconnected, notify
      if (hasShownError) {
        hasShownError = false
        if (errorResetTimer) { clearTimeout(errorResetTimer); errorResetTimer = null }
        toast.success('Real-time updates restored.', { id: 'realtime-reconnected', duration: 3000 })
      }
    }
  })
}
