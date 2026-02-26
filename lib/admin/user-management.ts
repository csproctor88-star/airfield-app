// Client-side functions wrapping admin API routes

export interface InviteUserPayload {
  email: string
  rank: string
  firstName: string
  lastName: string
  role: string
  installationId: string
}

export async function inviteUser(payload: InviteUserPayload) {
  const res = await fetch('/api/admin/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to invite user')
  return data
}

export async function resetUserPassword(email: string, userId: string) {
  const res = await fetch('/api/admin/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, userId }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to send reset email')
  return data
}

export async function updateUserProfile(
  userId: string,
  updates: Record<string, unknown>,
) {
  const res = await fetch(`/api/admin/users/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to update profile')
  return data
}

export async function deleteUser(userId: string) {
  const res = await fetch(`/api/admin/users/${userId}`, {
    method: 'DELETE',
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to delete user')
  return data
}
