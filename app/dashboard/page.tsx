import { createSupabaseRSC } from '@/utils/supabase/server'
import SearchForm from '@/components/SearchForm'
import { Suspense } from 'react'
import RecentSearches from '@/components/RecentSearches'
import RecentSearchesSkeleton from '@/components/RecentSearchesSkeleton'
import TipsInsights from '@/components/TipsInsights'
export default async function DashboardPage() {
  const supabase = await createSupabaseRSC()

  // who is logged in?
  let user: { id: string; email?: string | null } | null = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data && data.user ? (data.user as any) : null
  } catch {
    user = null
  }

  if (!user) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <h1 className="text-xl font-semibold mb-3">Dashboard</h1>
        <p className="mb-2">You are not logged in.</p>
        <p>
          <a href="/auth/login" className="underline text-blue-600">
            Log in
          </a>{' '}
          to continue.
        </p>
      </main>
    )
  }

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      {/* search bar */}
      <SearchForm defaultCity="" />

      {/* two-column layout */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* left: recent searches */}
        <Suspense fallback={<RecentSearchesSkeleton />}>
          <RecentSearches />
        </Suspense>

        {/* right: tips & insights */}
        <TipsInsights />
      </div>
    </main>
  )
}
