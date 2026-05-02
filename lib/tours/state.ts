import { createClient } from '@/lib/supabase/client'

export type ToursCompleted = Record<string, boolean>

async function loadCurrentRow(): Promise<{ userId: string; map: ToursCompleted } | null> {
  const supabase = createClient()
  if (!supabase) return null
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('tours_completed')
    .eq('id', user.id)
    .single()

  const map = (data as { tours_completed?: ToursCompleted | null } | null)?.tours_completed ?? {}
  return { userId: user.id, map: map ?? {} }
}

export async function isTourCompleted(tourId: string): Promise<boolean> {
  const row = await loadCurrentRow()
  return Boolean(row?.map?.[tourId])
}

export async function getCompletedTours(): Promise<ToursCompleted> {
  const row = await loadCurrentRow()
  return row?.map ?? {}
}

export async function markTourCompleted(tourId: string): Promise<void> {
  const supabase = createClient()
  if (!supabase) return
  const row = await loadCurrentRow()
  if (!row) return

  const next = { ...row.map, [tourId]: true }
  const { error } = await supabase
    .from('profiles')
    .update({ tours_completed: next } as never)
    .eq('id', row.userId)

  if (error) {
    console.error('[tours] markTourCompleted failed:', error.message)
  }
}
