export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import nextDynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/server'
import { PERM } from '@/lib/permissions'
import { getPermissionsFor } from '@/lib/permissions-server'

const PDFLibrary = nextDynamic(() => import('@/components/PDFLibrary'), { ssr: false })

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

  // Library page access gated on library:view. Use the shared server
  // helper so role-preset perms AND user_permission_overrides both
  // count — matches how usePermissions() resolves on the client.
  const perms = await getPermissionsFor(supabase, user.id)
  if (!perms.has(PERM.LIBRARY_VIEW)) {
    redirect('/more')
  }

  return <PDFLibrary />
}
