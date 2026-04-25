'use client'

import { useEffect } from 'react'
import { registerAllHandlers } from '@/lib/sync/handlers'
import { getWriteQueue } from '@/lib/sync/write-queue'

/**
 * App-shell-level component that boots the offline write queue:
 *
 *   1. Registers handlers for every wrapped WriteType.
 *   2. Subscribes to `online` and `visibilitychange` events so the queue
 *      drains opportunistically when connectivity / focus returns.
 *   3. Triggers an initial drain on mount in case writes were queued in a
 *      prior session before the user reloaded the app.
 *
 * Renders nothing. Mount once high in the authed layout tree.
 */
export function WriteQueueProvider() {
  useEffect(() => {
    const queue = getWriteQueue()
    registerAllHandlers(queue)
    const detach = queue.attach()
    void queue.drain()
    return detach
  }, [])

  return null
}
