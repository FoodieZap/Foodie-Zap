param(
  [string]$ProjectRoot = (Get-Location).Path
)

# Paths
$docs    = Join-Path $ProjectRoot "docs"
$logMd   = Join-Path $docs "BUILD_LOG.md"
$manifest= Join-Path $docs "FILE_MANIFEST.tsv"
$schema  = Join-Path $docs "SCHEMA.sql"
$pkgOut  = Join-Path $docs "PACKAGE.json"
$tscOut  = Join-Path $docs "TSCONFIG.json"
$envOut  = Join-Path $docs "ENV_KEYS.txt"

New-Item -ItemType Directory -Force -Path $docs | Out-Null

function Out-Line($text) { $text | Out-File -FilePath $logMd -Encoding utf8 -Append }
function CodeStart($lang="") { Out-Line("```$lang") }
function CodeEnd() { Out-Line("```") }

$Now = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

# --- Header ---
@"
# Foodie-Zap — Build Log
_Last updated: $Now_

> **Why this exists**  
> Paste/upload this file at the start of any new tab and we can continue instantly with full context.

---
"@ | Out-File -FilePath $logMd -Encoding utf8

# --- 1) File tree (source only) ---
Out-Line "## 1) Project File Tree (source only)"
Out-Line "_Excludes: node_modules, .next, .turbo, dist, build, .git_"
CodeStart
Get-ChildItem -Recurse -File $ProjectRoot `
  | Where-Object {
      ($_.FullName -notmatch '\\node_modules\\' -and
       $_.FullName -notmatch '\\\.next\\' -and
       $_.FullName -notmatch '\\\.turbo\\' -and
       $_.FullName -notmatch '\\dist\\' -and
       $_.FullName -notmatch '\\build\\' -and
       $_.FullName -notmatch '\\\.git\\' -and
       $_.Extension -ne ".zip")
    } `
  | ForEach-Object { $_.FullName.Replace($ProjectRoot, ".") } `
  | Sort-Object `
  | ForEach-Object { $_ } | Out-File -FilePath $logMd -Append -Encoding utf8
CodeEnd

# --- 2) File Manifest with hashes ---
"Path`tSize(bytes)`tSHA256" | Out-File -FilePath $manifest -Encoding utf8
Get-ChildItem -Recurse -File $ProjectRoot `
  | Where-Object {
      ($_.FullName -notmatch '\\node_modules\\' -and
       $_.FullName -notmatch '\\\.next\\' -and
       $_.FullName -notmatch '\\\.turbo\\' -and
       $_.FullName -notmatch '\\dist\\' -and
       $_.FullName -notmatch '\\build\\' -and
       $_.FullName -notmatch '\\\.git\\' -and
       $_.Extension -ne ".zip")
    } `
  | ForEach-Object {
      $hash = (Get-FileHash -Algorithm SHA256 -Path $_.FullName).Hash
      "$($_.FullName.Replace($ProjectRoot, '.'))`t$($_.Length)`t$hash"
    } | Out-File -FilePath $manifest -Append -Encoding utf8

Out-Line "## 2) File Manifest"
Out-Line "_Full manifest with sizes + SHA256 at **docs/FILE_MANIFEST.tsv**_"

# --- 3) package.json / tsconfig.json snapshots ---
if (Test-Path (Join-Path $ProjectRoot "package.json")) {
  Copy-Item (Join-Path $ProjectRoot "package.json") $pkgOut -Force
  Out-Line "## 3) package.json (snapshot)"
  CodeStart "json"; Get-Content $pkgOut -Raw | Out-File -FilePath $logMd -Append -Encoding utf8; CodeEnd
}

if (Test-Path (Join-Path $ProjectRoot "tsconfig.json")) {
  Copy-Item (Join-Path $ProjectRoot "tsconfig.json") $tscOut -Force
  Out-Line "## 4) tsconfig.json (snapshot)"
  CodeStart "json"; Get-Content $tscOut -Raw | Out-File -FilePath $logMd -Append -Encoding utf8; CodeEnd
}

# --- 5) Env keys (names only) ---
$envFiles = @(".env", ".env.local", ".env.example") | ForEach-Object { Join-Path $ProjectRoot $_ } | Where-Object { Test-Path $_ }
$keys = @()
foreach ($f in $envFiles) {
  $keys += Get-Content $f | Where-Object { $_ -match '^[A-Z0-9_]+\s*=' } | ForEach-Object { ($_ -split '=')[0].Trim() }
}
$keys = $keys | Sort-Object -Unique
if ($keys.Count -gt 0) {
  $keys | Out-File -FilePath $envOut -Encoding utf8
  Out-Line "## 5) Environment Keys (names only)"
  CodeStart; $keys | Out-File -FilePath $logMd -Append -Encoding utf8; CodeEnd
}

# --- 6) Route map (Next.js app router) ---
Out-Line "## 6) Route Map (Next.js app router)"
Out-Line "### Pages"
CodeStart
if (Test-Path (Join-Path $ProjectRoot "app")) {
  Get-ChildItem -Recurse -File (Join-Path $ProjectRoot "app") `
    | Where-Object { $_.Name -ieq "page.tsx" -or $_.Name -ieq "page.ts" } `
    | ForEach-Object { $_.FullName.Replace($ProjectRoot, ".") } `
    | Sort-Object | Out-File -FilePath $logMd -Append -Encoding utf8
}
CodeEnd

Out-Line "### API Routes"
CodeStart
if (Test-Path (Join-Path $ProjectRoot "app")) {
  Get-ChildItem -Recurse -File (Join-Path $ProjectRoot "app") `
    | Where-Object { $_.Name -ieq "route.ts" -or $_.Name -ieq "route.tsx" } `
    | ForEach-Object { $_.FullName.Replace($ProjectRoot, ".") } `
    | Sort-Object | Out-File -FilePath $logMd -Append -Encoding utf8
}
CodeEnd

# --- 7) Components inventory ---
if (Test-Path (Join-Path $ProjectRoot "components")) {
  Out-Line "## 7) Components Inventory"
  CodeStart
  Get-ChildItem -Recurse -File (Join-Path $ProjectRoot "components") `
    | Where-Object { $_.Extension -in ".tsx", ".ts", ".jsx", ".js" } `
    | ForEach-Object { $_.FullName.Replace($ProjectRoot, ".") } `
    | Sort-Object | Out-File -FilePath $logMd -Append -Encoding utf8
  CodeEnd
}

# --- 8) Database Schema (if migrations exist) ---
if (Test-Path (Join-Path $ProjectRoot "supabase")) {
  $migFiles = Get-ChildItem -Recurse -File (Join-Path $ProjectRoot "supabase") | Where-Object { $_.Extension -eq ".sql" }
  if ($migFiles.Count -gt 0) {
    "# Concatenated migration SQL from supabase/ (for reference)" | Out-File -FilePath $schema -Encoding utf8
    foreach ($mf in ($migFiles | Sort-Object FullName)) {
      "`n-- ===== $($mf.FullName.Replace($ProjectRoot, '.')) =====`n" | Out-File -FilePath $schema -Append -Encoding utf8
      Get-Content $mf.FullName | Out-File -FilePath $schema -Append -Encoding utf8
    }
    Out-Line "## 8) Database Schema (from supabase/ migrations, concatenated)"
    CodeStart "sql"; Get-Content $schema -Raw | Out-File -FilePath $logMd -Append -Encoding utf8; CodeEnd
  } else {
    Out-Line "## 8) Database Schema"
    Out-Line "_No migrations found. Consider exporting via Supabase Studio or CLI (see Section 9)._"
  }
} else {
  Out-Line "## 8) Database Schema"
  Out-Line "_No supabase/ folder found. Consider exporting via Supabase Studio or CLI (see Section 9)._"
}

# --- 9) RLS Policies & Handy SQL (template) ---
Out-Line "## 9) RLS Policies & Handy SQL (template)"
Out-Line "_Customize these to match your exact schema if different._"
CodeStart "sql"
@'
-- Example policies (owner-based)
-- (Run in Supabase SQL editor; adjust table/column names if needed)

alter table public.searches enable row level security;
drop policy if exists searches_select on public.searches;
create policy searches_select on public.searches for select using (auth.uid() = user_id);
drop policy if exists searches_insert on public.searches;
create policy searches_insert on public.searches for insert with check (auth.uid() = user_id);
drop policy if exists searches_update on public.searches;
create policy searches_update on public.searches for update using (auth.uid() = user_id);
drop policy if exists searches_delete on public.searches;
create policy searches_delete on public.searches for delete using (auth.uid() = user_id);

alter table public.competitors enable row level security;
drop policy if exists competitors_select on public.competitors;
create policy competitors_select on public.competitors
  for select using (
    exists (
      select 1 from public.searches s where s.id = search_id and s.user_id = auth.uid()
    )
  );

alter table public.watchlist enable row level security;
drop policy if exists watchlist_select on public.watchlist;
create policy watchlist_select on public.watchlist for select using (auth.uid() = user_id);
drop policy if exists watchlist_insert on public.watchlist;
create policy watchlist_insert on public.watchlist for insert with check (auth.uid() = user_id);
drop policy if exists watchlist_delete on public.watchlist;
create policy watchlist_delete on public.watchlist for delete using (auth.uid() = user_id);

alter table public.insights enable row level security;
drop policy if exists insights_select on public.insights;
create policy insights_select on public.insights for select using (auth.uid() = user_id);
drop policy if exists insights_insert on public.insights;
create policy insights_insert on public.insights for insert with check (auth.uid() = user_id);
drop policy if exists insights_update on public.insights;
create policy insights_update on public.insights for update using (auth.uid() = user_id);
drop policy if exists insights_delete on public.insights;
create policy insights_delete on public.insights for delete using (auth.uid() = user_id);
'@ | Out-File -Append -Encoding utf8
CodeEnd

# --- 10) API contracts & props (stubs) ---
Out-Line "## 10) API Contracts (fill as you finalize)"
Out-Line "- POST /api/search → body, response"
Out-Line "- POST /api/insights?searchId= → { ok, summary, actions }"
Out-Line "- POST /api/menus/placeholder?searchId= → { ok }"
Out-Line "- POST /api/watchlist { competitor_id } → { ok }"
Out-Line "- DELETE /api/watchlist?competitor_id= → { ok }"
Out-Line "- GET /api/export-csv?search_id= → file"
Out-Line "- GET /api/export/xlsx?searchId= → file"

Out-Line "## 11) Component Props (current contracts)"
Out-Line "- ResultsView({ items, centerLat?, centerLng?, watchlistIds? })"
Out-Line "- ResultsTable({ items, centerLat?, centerLng?, initialWatchlistIds? })"
Out-Line "- ResultsMap({ items, centerLat?, centerLng? })"
Out-Line "- GeneratePlaceholders({ searchId })"
Out-Line "- ActionsCard({ summary, actions })"
Out-Line "- MenuCard({ menus })"

# --- 12) How to use in a new tab ---
@"
## 12) How to use this log in a new ChatGPT tab
1. Upload **docs/BUILD_LOG.md** (and optionally **docs/FILE_MANIFEST.tsv**) at the start of the new chat.
2. Say: “Here’s the latest Build Log for Foodie‑Zap. Continue from here.”
3. If we change code, ask me to “Update the Build Log,” then re-run this script to regenerate.

---
"@ | Out-File -FilePath $logMd -Append -Encoding utf8

Write-Host "✅ Build Log generated at $logMd"
Write-Host "✅ Manifest at $manifest"
if (Test-Path $schema) { Write-Host "✅ Schema at $schema" } else { Write-Host "ℹ No schema dump found (see Section 8/9 in BUILD_LOG.md)" }
