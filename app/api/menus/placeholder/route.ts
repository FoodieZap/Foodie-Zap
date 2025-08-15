// app/api/menus/placeholder/route.ts
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createSupabaseRoute } from '@/utils/supabase/route'

const COFFEE_ITEMS = [
  { name: 'Latte', price: 5.5 },
  { name: 'Cappuccino', price: 5.0 },
  { name: 'Americano', price: 4.0 },
  { name: 'Cold Brew', price: 5.25 },
  { name: 'Iced Matcha', price: 5.75 },
  { name: 'Croissant', price: 3.75 },
  { name: 'Avocado Toast', price: 8.5 },
]

const PIZZA_ITEMS = [
  { name: 'Margherita', price: 14 },
  { name: 'Pepperoni', price: 16 },
  { name: 'BBQ Chicken', price: 18 },
  { name: 'Veggie Supreme', price: 17 },
  { name: 'Garlic Knots', price: 7 },
  { name: 'Caesar Salad', price: 10 },
]

function pickSet(sourceHint: string | null | undefined) {
  const s = (sourceHint ?? '').toLowerCase()
  if (s.includes('pizza') || s.includes('italian')) return PIZZA_ITEMS
  return COFFEE_ITEMS
}

export async function POST(req: Request) {
  const supabase = createSupabaseRoute()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const searchId = searchParams.get('searchId')
  if (!searchId) {
    return NextResponse.json({ error: 'searchId is required' }, { status: 400 })
  }

  // 1) Load competitors for this search (RLS enforces ownership)
  const { data: comps, error: compErr } = await supabase
    .from('competitors')
    .select('id, name, cuisine, price_level')
    .eq('search_id', searchId)
    .limit(200)
  if (compErr) return NextResponse.json({ error: compErr.message }, { status: 500 })

  // 2) Build placeholder menu rows
  const rows = (comps ?? []).map((c) => {
    const base = pickSet(c.cuisine ?? c.name ?? null)
    // Simple average from the chosen set
    const avg = Math.round((base.reduce((sum, x) => sum + x.price, 0) / base.length) * 100) / 100

    // Random-ish mentions to make it look real (deterministic using id hash)
    const seed = c.id.split('-')[0].length
    const top_items = base.slice(0, 5).map((x, i) => ({
      name: x.name,
      est_price: x.price,
      mentions: 20 + ((seed + i * 7) % 60),
    }))

    return {
      competitor_id: c.id,
      source: 'placeholder',
      avg_price: avg,
      currency: 'USD',
      top_items,
      data: { placeholder: true },
    }
  })

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0 })
  }

  // 3) Upsert (one per competitor)
  const { error: upErr } = await supabase
    .from('menus')
    .upsert(rows, { onConflict: 'competitor_id' })

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
  return NextResponse.json({ ok: true, inserted: rows.length })
}
