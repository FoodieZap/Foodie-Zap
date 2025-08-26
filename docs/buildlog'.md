# Foodie‑Zap — Build Log

_Last updated: 2025-08-20 02:20:40_

> **Why this exists**  
> Each tab has a limited memory window. This living document is the single source of truth so we can jump between tabs without losing context.

---

## 0) Working Notes (Latest Ground Truth)

- Next.js **15** upgrade: `cookies()` and route `{params, searchParams}` are **async**. We updated helpers and pages accordingly.
- Supabase server helpers:
  - `utils/supabase/server.ts` → `createSupabaseRSC()` **async**, `await cookies()`; `set/remove` **no‑ops** in RSC.
  - `utils/supabase/route.ts` → `createSupabaseRoute()` **async**, `await cookies()`; `set/remove` **no‑ops** in routes.
  - `lib/supabase.ts` → `createSupabaseServer()` for server actions; casts to allow `cookieStore.set(...)` where needed.
- `/results/[searchId]` page is `force-dynamic` and now **awaits** `params` and `searchParams`.
- **Generate Insights** endpoint implemented at `POST /api/insights?searchId=...` + `router.refresh()` on success.
- **Exports**: CSV `/api/export-csv?search_id=` and XLSX `/api/export/xlsx?searchId=` both functional.
- **Note:** The uploaded zip contains `.next/` build artifacts but **not the source folders** (`app/`, `components/`, `utils/`, `lib/`). We can’t diff source from this zip.

---

## 1) Environment & Runbook

- Node: use project’s engines if specified; typical: Node 18+.
- Scripts:
  - `npm run dev` — start Next.js dev
  - `npm run build` — production build
  - `npm run start` — start production server
  - `npm run check` — recommended to add: `tsc --noEmit && next lint`
- .env keys (example):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Any third‑party API keys (Google, Yelp, Apify, OpenAI) — **not yet wired** in this snapshot.

---

## 2) Database Schema (Supabase)

> RLS: **enabled** on all user‑scoped tables; policies restrict to `auth.uid() = user_id`.

### `public.searches`

- `id uuid pk`
- `user_id uuid not null → auth.users`
- `query text/jsonb`
- `city text`
- `latitude float8`
- `longitude float8`
- `status text` (ok/error)
- `total_competitors int` (optional convenience count)
- `created_at timestamptz default now()`

### `public.competitors`

- `id uuid pk`
- `search_id uuid → searches(id) on delete cascade`
- Core fields: `name, source, rating, review_count, price_level, address, lat, lng, data jsonb`
- Index: `idx_competitors_search_id (search_id)`

### `public.watchlist`

- `id uuid pk`
- `user_id uuid → auth.users`
- `search_id uuid → searches(id)`
- `competitor_id uuid → competitors(id)`
- (Planned) `note text`
- Index: `(user_id, search_id)`

### `public.menus`

- `id uuid pk`
- `competitor_id uuid → competitors(id)`
- `avg_price numeric`
- `top_items text[]`

### `public.insights`

- `search_id uuid pk → searches(id) on delete cascade`
- `user_id uuid → auth.users`
- `summary text`
- `actions text[]`
- Unique index: `insights_search_id_key on (search_id)`

**RLS Policies (summary)**

- `searches`: select/insert/update/delete where `auth.uid() = user_id`
- `competitors`: select where `exists (select 1 from searches s where s.id = search_id and s.user_id = auth.uid())`
- `watchlist`: select/insert/delete where `auth.uid() = user_id`
- `insights`: select/insert/update/delete where `auth.uid() = user_id`

_SQL snippets used are available on request; we avoided `create policy if not exists` because Postgres doesn’t support it._

---

## 3) API Endpoints

- `POST /api/search` — run a search; inserts into `searches` + `competitors`.
- `GET /api/competitors/[id]` — (if present) load a competitor.
- `POST /api/menus/placeholder?searchId=` — placeholder menus generation.
- `POST /api/insights?searchId=` — deterministic insights → upsert into `insights`.
- `POST /api/watchlist` `{{ competitor_id }}` — add.
- `DELETE /api/watchlist?competitor_id=` — remove.
- `GET /api/export-csv?search_id=` — CSV export.
- `GET /api/export/xlsx?searchId=` — XLSX export.
- **Note:** Export endpoints should accept filter query params to match the table view (pending).

---

## 4) Frontend Pages & Components

### Pages

- `/` — home/onboarding (TBD).
- `/results/[searchId]` — **force-dynamic**; loads search, competitors (paged), menus, insights; shows `ResultsView`, `MenuCard`, `ActionsCard`; has export buttons.
- `/history` — lists previous searches (needs UI polish & pagination).
- `/watchlist` — shows saved competitors (notes pending).
- `/auth/*` — login/logout actions using server actions.

### Core Components

- `ResultsView` (client): props
  - `items: Competitor[]`
  - `centerLat?: number | null`
  - `centerLng?: number | null`
  - `watchlistIds?: string[]` (optional)
- `ResultsTable` (client): props
  - `items: Competitor[]`
  - `centerLat/centerLng?: number | null`
  - `initialWatchlistIds?: string[]`
  - Local filters: `minRating`, `price`, `maxDistanceKm`, `sortBy`
- `ResultsMap` (client): shows pins; clustering **pending**
- `GeneratePlaceholders` (client): posts to menus/insights; **calls `router.refresh()`**
- `ActionsCard` (server/client): displays `summary` + `actions`
- `MenuCard` (server/client): displays `avg_price` + `top_items`

---

## 5) Known Issues / Gaps

- Filters **not URL‑synced**; exports don’t honor client filters yet.
- Pagination is **offset-based**; MVP requests **cursor-based**.
- Clustering not implemented in `ResultsMap`.
- `/competitors/[id]` detail page missing.
- Watchlist **notes** not implemented.
- Menus pipeline integrates Apify — **placeholder only**.
- Google Trends fallback — **not implemented**.
- OpenAI insights — rules‑based only (no LLM call).
- Analytics (PostHog/Umami) and Sentry — not installed.
- Micro‑caching for place details — not implemented.
- Onboarding defaults (city/radius, sample query) — not implemented.

---

## 6) Next Actions (MVP order)

1. **Filters & Sorting parity**
   - URL sync in `ResultsTable` → parse on server → export endpoints respect filters.
2. **History polish**
   - Empty state, counts, clickable rows; persist `total_competitors`.
3. **Cursor pagination** on results.
4. **Map clustering**.
5. **Competitor detail** page.
6. **Watchlist notes**.
7. **Menus pipeline (Apify)** → fill `avg_price`, `top_items`.
8. **AI Insights (OpenAI)** → LLM summary + bullets; deterministic fallback.
9. **Analytics & Sentry**.
10. **Onboarding defaults** / sample query.

---

## 7) Source zip guidance (so I can fully analyze code)

The uploaded archive only contains `.next/` (compiled build). Please send the **source**:

- Include: `app/`, `components/`, `lib/`, `utils/`, `public/`, `package.json`, `tsconfig.json`, `.env.example`, `supabase/` (if you have migrations).
- Exclude: `.next/`, `node_modules/`, `.turbo/`.

**One‑liner (PowerShell, excludes heavy folders):**

```powershell
Compress-Archive -Path "C:\Users\alexa\Foodie-Zap\*" -DestinationPath "C:\Users\alexa\Foodie-Zap_src.zip" -Force -CompressionLevel Optimal -Exclude *.zip,node_modules\*,.next\*,.turbo\*,dist\*,build\*
```

---

## 8) Changelog (recent)

- Fixed Next 15 async `cookies()` and async `{params, searchParams}` patterns.
- Implemented `/api/insights` + page refresh on success.
- Unified `ResultsView` props to `items` and computed map center fallback.
- Cleaned up TypeScript errors in helpers and pages.

---

> **How to use this doc**
>
> - When we finish a feature, update its status here.
> - When starting a new tab, paste the most recent **Working Notes** and the link to this file.

## Planned Features (MVP+ / Roadmap)

### Data & Insights

- **Apify Menus pipeline** → store structured menu data per competitor (avg price, items, categories).
- **AI Menu Analyzer (on-demand)** → Given stored menu data, produce:
  - Top-performing items
  - Price bands and outliers
  - Cross-sell/upsell bundles
  - Pricing recommendations
  - Suggested limited-time offers (LTOs)
- **Global Insights upgrade** → richer, multi-axis suggestions across Pricing, Menu, Marketing, Ops (deterministic + LLM hybrid).

### Competitor Page Enhancements

- **Notes v2**
  - Rich text + tags
  - Search/filter within notes
  - Pin note to top
- **Photos & Media**
  - Pull a couple of images (Google/Yelp) where available
  - Lightbox viewer
- **Contact & Links**
  - Quick actions: Call, Directions, Website, “Open in Maps”
- **Open Hours & Live Status**
  - Parse/store hours, show “Open now/Closed” with next open time
- **Menu Preview**
  - Compact preview from stored Apify data (categories → top items, avg price)
  - “Analyze Menu” button → triggers AI Menu Analyzer (writes results to DB)
- **Competitor Similarity**
  - “Similar spots nearby” (cosine on category/price/rating vectors)
- **Performance Signals**
  - Trend badges: “High rating”, “High review velocity”, “Price leader”, etc.
- **Watchlist Intelligence**
  - Show if this competitor is on watchlist (done)
  - Mini notes count badge (done)
  - Quick add note inline

### Results Page (for reference)

- **AI Menu Analyzer trigger** (on-demand per search)
- **Menus pipeline** surfaced inline (avg price, top items per row)
- **Filters expansion** (hours open now, category, has menu/photos)

_Last updated: add today’s date here_
