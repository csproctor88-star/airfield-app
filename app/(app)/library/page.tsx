export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import nextDynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/server'
import { PERM } from '@/lib/permissions'

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

  // Library page access gated on library:view. Resolved via the
  // matrix so the gate matches both the sidebar visibility map and
  // the RLS on pdf_extraction_status / pdf_text_pages.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rolePerms } = await (supabase as any)
    .from('role_permissions')
    .select('permission_key')
    .eq('role',
      (await supabase.from('profiles').select('role').eq('id', user!.id).single()).data?.role ?? 'read_only'
    )
  const perms = new Set<string>((rolePerms ?? []).map((r: { permission_key: string }) => r.permission_key))
  if (!perms.has(PERM.LIBRARY_VIEW)) {
    redirect('/more')
  }

  return <PDFLibrary />
}
