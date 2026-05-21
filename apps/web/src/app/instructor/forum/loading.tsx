import { Skeleton, SkeletonHeader, SkeletonTable, SkeletonChip } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <SkeletonHeader />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card">
            <Skeleton className="h-7 w-16" />
            <Skeleton className="mt-2 h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonChip key={i} />
        ))}
      </div>
      <div className="mt-6">
        <SkeletonTable rows={8} cols={6} />
      </div>
    </main>
  );
}
