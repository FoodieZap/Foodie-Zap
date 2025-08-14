export const dynamic = 'force-dynamic' // avoid any cache

import { redirect } from 'next/navigation'
import { createSupabaseRSC } from '@/utils/supabase/server'

export default async function DashboardPage() {
  const supabase = createSupabaseRSC()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, username, avatar_url')
    .eq('id', user.id)
    .single()

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">
        Welcome{profile?.full_name ? `, ${profile.full_name}` : ''} 👋
      </h1>
      <p className="mt-2 text-sm text-gray-500">User ID: {user.id}</p>
      <div className="mt-6 space-y-2">
        <div>
          <span className="font-medium">Username:</span> {profile?.username ?? '—'}
        </div>
        <div>
          <span className="font-medium">Full name:</span> {profile?.full_name ?? '—'}
        </div>
        <div>
          <span className="font-medium">Avatar URL:</span> {profile?.avatar_url ?? '—'}
        </div>
      </div>
    </div>
  )
}
