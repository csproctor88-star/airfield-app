export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { USER_ROLES } from '@/lib/constants'
import type { UserRole } from '@/lib/supabase/types'
import PDFLibrary from '@/components/PDFLibrary'

export default async function LibraryPage() {
  const supabase = createClient()

  // Demo mode — no Supabase configured
  if (!supabase) {
    return <PDFLibrary />
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch profile for role check
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = (profile?.role ?? 'observer') as UserRole
  const roleConfig = USER_ROLES[role]

  // Only users with canManageUsers (sys_admin, airfield_manager) can access
  if (!roleConfig?.canManageUsers) {
    redirect('/more')
  }

  return <PDFLibrary />
}
