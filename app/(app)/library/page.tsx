export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import nextDynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/server'

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

  // Library page access gated on library:view. Use the SECURITY DEFINER
  // RPC directly — it resolves role preset + user_permission_overrides
  // server-side in one round-trip and avoids cross-import of helpers
  // from the `'use client'` permissions module (importing from there
  // into a server component produces client-reference stubs that throw
  // "is not a function" when invoked — see comment in lib/permissions.ts).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: hasView, error } = await (supabase as any).rpc('user_has_permission', {
    p_user_id: user!.id,
    p_key: 'library:view',
  })
  if (error || !hasView) {
    redirect('/more')
  }

  return <PDFLibrary />
}
