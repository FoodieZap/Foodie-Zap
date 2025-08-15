export default function ActionsCard({
  summary,
  actions,
}: {
  summary: string | null
  actions: string[] | null
}) {
  return (
    <div className="rounded border bg-white p-4">
      <div className="font-semibold">Action Steps</div>
      {summary ? (
        <p className="mt-1 text-sm text-gray-700">{summary}</p>
      ) : (
        <p className="mt-1 text-sm text-gray-500">No insights yet.</p>
      )}
      <ul className="mt-3 list-disc pl-5 text-sm text-gray-800">
        {(actions ?? []).map((a, i) => (
          <li key={i}>{a}</li>
        ))}
      </ul>
    </div>
  )
}
