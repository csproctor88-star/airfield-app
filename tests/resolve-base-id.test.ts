import { describe, it, expect, vi } from 'vitest'
import { resolveBaseId } from '@/lib/supabase/resolve-base-id'

// Guards the safe-by-construction property behind the user_has_base_access NULL
// hardening: every base-scoped write resolves a non-null base_id when one can be
// determined, and yields null (→ RLS refuses the write) only when it genuinely
// cannot — never silently inserting a NULL-base orphan.

function mockClient(opts: { userId?: string | null; primaryBaseId?: string | null } = {}) {
  const getUser = vi.fn().mockResolvedValue({ data: { user: opts.userId ? { id: opts.userId } : null } })
  const single = vi.fn().mockResolvedValue({ data: opts.primaryBaseId ? { primary_base_id: opts.primaryBaseId } : null })
  const eq = vi.fn().mockReturnValue({ single })
  const select = vi.fn().mockReturnValue({ eq })
  const from = vi.fn().mockReturnValue({ select })
  return { client: { auth: { getUser }, from } as never, getUser, from }
}

describe('resolveBaseId', () => {
  it('returns the explicit base_id without touching the DB (common path)', async () => {
    const { client, getUser, from } = mockClient()
    expect(await resolveBaseId(client, 'base-A')).toBe('base-A')
    expect(getUser).not.toHaveBeenCalled()
    expect(from).not.toHaveBeenCalled()
  })

  it('falls back to the known user\'s primary base when no base_id is supplied', async () => {
    const { client, getUser } = mockClient({ primaryBaseId: 'base-primary' })
    expect(await resolveBaseId(client, null, 'user-1')).toBe('base-primary')
    expect(getUser).not.toHaveBeenCalled() // knownUserId provided → no auth round-trip
  })

  it('resolves the current user when no base_id and no known user id', async () => {
    const { client, getUser } = mockClient({ userId: 'user-2', primaryBaseId: 'base-2' })
    expect(await resolveBaseId(client)).toBe('base-2')
    expect(getUser).toHaveBeenCalledOnce()
  })

  it('returns null when neither a base nor a user/primary base exists (RLS will refuse the write)', async () => {
    const { client } = mockClient({ userId: null })
    expect(await resolveBaseId(client)).toBeNull()
  })

  it('returns null when the user has no primary base', async () => {
    const { client } = mockClient({ userId: 'user-3', primaryBaseId: null })
    expect(await resolveBaseId(client)).toBeNull()
  })
})
