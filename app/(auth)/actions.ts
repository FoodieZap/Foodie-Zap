'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseRoute } from '@/utils/supabase/route'

export async function signOut() {
  const supabase = createSupabaseRoute()
  await supabase.auth.signOut() // allowed to write cookies here
  revalidatePath('/') // refresh the home page UI
}
