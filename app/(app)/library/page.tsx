export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PDFLibraryClient from './pdf-library-client'

export default async function LibraryPage() {
  const supabase = await createClient()

  // Demo mode — no Supabase configured
  if (!supabase) {
    return <PDFLibraryClient />
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
  const { data: hasView, error } = await supabase.rpc('user_has_permission', {
    p_user_id: user!.id,
    p_key: 'library:view',
  })
  if (error || !hasView) {
    redirect('/more')
  }

  return <PDFLibraryClient />
}
