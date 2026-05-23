export default function LeaderboardLoading() {
  return (
    <div className="space-y-4 p-6">
      <div className="h-8 w-72 animate-pulse rounded-lg bg-base-100" />
      <div className="h-4 w-96 animate-pulse rounded bg-base-100" />
      <div className="mt-6 space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-xl border border-token bg-base-100"
          />
        ))}
      </div>
    </div>
  );
}
