import { toast } from 'sonner'
import type { RealtimeChannel } from '@supabase/supabase-js'

/** Module-level flag tracking whether any realtime channel is connected */
let connected = false

// The browser's `offline` event is a far more reliable signal that realtime
// has stopped delivering than waiting for a channel to emit CHANNEL_ERROR /
// TIMED_OUT, which can lag the actual network drop by many seconds (or never
// fire for the tab that went offline). Reset eagerly so isRealtimeConnected()
// and warnIfRealtimeDown() reflect reality immediately. A real reconnect
// flips it back to true via the SUBSCRIBED status below.
if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => {
    connected = false
  })
}

/**
 * Call after a user action that expects a realtime push (e.g., updating
 * airfield status, filing an inspection). If realtime is down, shows a
 * single non-blocking warning so the user knows the change was saved
 * but may not appear for other users until they refresh.
 */
export function warnIfRealtimeDown() {
  if (!connected) {
    toast.warning('Your change was saved, but real-time sync is temporarily unavailable. Other users may need to refresh.', {
      id: 'realtime-push-warning',
      duration: 6000,
    })
  }
}

/**
 * Subscribe to a Supabase Realtime channel with silent error handling.
 * Connection issues are logged to the console only. The `connected` flag
 * is updated so that `warnIfRealtimeDown()` can surface a warning at the
 * right moment — when the user takes an action, not on page load.
 */
export function subscribeWithErrorHandling(channel: RealtimeChannel): RealtimeChannel {
  return channel.subscribe((status, err) => {
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      connected = false
      console.warn(`[Realtime] Channel ${status}:`, err?.message || 'unknown error')
    }
    if (status === 'SUBSCRIBED') {
      connected = true
    }
  })
}
