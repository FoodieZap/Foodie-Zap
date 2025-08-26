'use client'
export default function RecentSearchesSkeleton() {
  return (
    <div className="rounded border p-3">
      <div className="font-semibold mb-3">Recent Searches</div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
            <div className="h-3 bg-gray-200 rounded w-1/3" />
          </div>
        ))}
      </div>
    </div>
  )
}
