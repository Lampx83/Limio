export default function TournamentsLoading() {
  return (
    <div className="space-y-4 p-6">
      <div className="h-8 w-72 animate-pulse rounded-lg bg-base-100" />
      <div className="h-4 w-96 animate-pulse rounded bg-base-100" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-2xl border border-token bg-base-100"
          />
        ))}
      </div>
    </div>
  );
}
