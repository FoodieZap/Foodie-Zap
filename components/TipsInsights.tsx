// components/TipsInsights.tsx
export const dynamic = 'force-dynamic'

import { createSupabaseRSC } from '@/utils/supabase/server'
import { Lightbulb, CheckCircle2, ArrowRight } from 'lucide-react'

type Tip = { title: string; detail?: string; href?: string }

export default async function TipsInsights() {
  const supabase = await createSupabaseRSC()

  // Fetch quick signals to personalize tips (all RLS-protected)
  const [{ count: searchCount }, { count: watchCount }, { data: latestInsight }] =
    await Promise.all([
      supabase.from('searches').select('id', { count: 'exact', head: true }),
      supabase.from('watchlist').select('competitor_id', { count: 'exact', head: true }),
      supabase
        .from('insights')
        .select('summary, actions, search_id, created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

  const tips: Tip[] = []

  // Onboarding / basic flow
  if (!searchCount || searchCount === 0) {
    tips.push(
      {
        title: 'Start by running your first search',
        detail: 'Pick a city and a query like “coffee” or “sushi” to see competitors.',
        href: '/dashboard',
      },
      {
        title: 'Save interesting places to your Watchlist',
        detail: 'Use the ★ star in the results list. You can add notes later.',
        href: '/watchlist',
      },
    )
  } else {
    // User has searches
    tips.push({
      title: 'Use filters + sorting to focus',
      detail: 'Try narrowing by rating, distance, or price, then export CSV/XLSX.',
      href: '/history',
    })
  }

  // Watchlist guidance
  if (!watchCount || watchCount === 0) {
    tips.push({
      title: 'Build a short Watchlist',
      detail: 'Star 5–10 competitors you care about and jot quick notes.',
      href: '/watchlist',
    })
  } else {
    tips.push({
      title: 'Prioritize your Watchlist',
      detail: 'Sort starred items by rating or review volume to pick targets.',
      href: '/watchlist',
    })
  }

  // Insights nudge (placeholder now, real AI later)
  if (latestInsight?.summary) {
    tips.push({
      title: 'Review your latest Action Steps',
      detail: latestInsight.summary,
      href: `/results/${latestInsight.search_id}`,
    })
  } else {
    tips.push({
      title: 'Generate Insights for a search',
      detail: 'On a results page, click “Generate Insights” to see actionable steps.',
    })
  }

  return (
    <div className="rounded border p-4">
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb className="h-5 w-5 text-amber-500" />
        <h2 className="text-lg font-semibold">Tips & Insights</h2>
      </div>

      <ul className="space-y-3">
        {tips.map((t, i) => (
          <li key={i} className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" />
            <div className="min-w-0">
              <div className="font-medium">{t.title}</div>
              {t.detail && <div className="text-sm text-gray-600">{t.detail}</div>}
              {t.href && (
                <a
                  href={t.href}
                  className="inline-flex items-center gap-1 text-sm text-blue-600 underline mt-1"
                >
                  Open <ArrowRight className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
