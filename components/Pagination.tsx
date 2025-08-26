'use client'

export default function Pagination({
  prevHref,
  nextHref,
  hasPrev,
  hasNext,
}: {
  prevHref: string | null
  nextHref: string | null
  hasPrev: boolean
  hasNext: boolean
}) {
  return (
    <div className="flex items-center justify-center gap-3 mt-2">
      {hasPrev && prevHref ? (
        <a href={prevHref} className="px-3 py-1 rounded border text-sm hover:bg-gray-100">
          ← Prev
        </a>
      ) : (
        <span className="px-3 py-1 rounded border text-sm opacity-50 cursor-not-allowed">
          ← Prev
        </span>
      )}

      <span className="text-sm text-gray-600">Page</span>

      {hasNext && nextHref ? (
        <a href={nextHref} className="px-3 py-1 rounded border text-sm hover:bg-gray-100">
          Next →
        </a>
      ) : (
        <span className="px-3 py-1 rounded border text-sm opacity-50 cursor-not-allowed">
          Next →
        </span>
      )}
    </div>
  )
}
