// app/api/export/xlsx/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseRoute } from '@/utils/supabase/route'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const supabase = await createSupabaseRoute()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const searchId = searchParams.get('searchId') ?? searchParams.get('search_id')
  if (!searchId) {
    return NextResponse.json({ error: 'searchId is required' }, { status: 400 })
  }
  const isWatchlist = searchParams.get('watchlist') === '1'

  try {
    let rows: any[] = []
    let filename = 'export.xlsx'

    if (isWatchlist) {
      // export watchlist (joined with competitor fields)
      const { data, error } = await supabase
        .from('watchlist')
        .select(
          `
          note, created_at, updated_at,
          competitors:competitor_id (
            id, search_id, name, source, rating, review_count, price_level, address, phone, website, lat, lng
          )
        `,
        )
        .order('created_at', { ascending: false })
      if (error) throw error

      rows = (data ?? []).map((r: any) => ({
        name: r.competitors?.name ?? null,
        source: r.competitors?.source ?? null,
        rating: r.competitors?.rating ?? null,
        review_count: r.competitors?.review_count ?? null,
        price_level: r.competitors?.price_level ?? null,
        address: r.competitors?.address ?? null,
        phone: r.competitors?.phone ?? null,
        website: r.competitors?.website ?? null,
        lat: r.competitors?.lat ?? null,
        lng: r.competitors?.lng ?? null,
        note: r.note ?? null,
        saved_at: r.created_at,
        updated_at: r.updated_at,
      }))
      filename = 'watchlist.xlsx'
    } else if (searchId) {
      // export competitors for a search
      const { data: search, error: sErr } = await supabase
        .from('searches')
        .select('id, query, city, created_at')
        .eq('id', searchId)
        .single()
      if (sErr || !search) {
        return NextResponse.json({ error: 'Search not found or inaccessible' }, { status: 404 })
      }

      const { data, error } = await supabase
        .from('competitors')
        .select(
          'name, source, rating, review_count, price_level, address, phone, website, lat, lng',
        )
        .eq('search_id', searchId)
        .order('review_count', { ascending: false })
      if (error) throw error

      rows = data ?? []
      filename = `results_${search.query}_${search.city}.xlsx`.replace(/[^\w.()-]+/g, '_')
    } else {
      return NextResponse.json({ error: 'Provide searchId or watchlist=1' }, { status: 400 })
    }

    // Build workbook
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Data')
    const xbuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(xbuf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Export failed' }, { status: 500 })
  }
}
