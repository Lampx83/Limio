import { Skeleton, SkeletonHeader } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main>
      <SkeletonHeader />
      <div className="mt-6 flex flex-wrap gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-32" rounded="rounded-lg" />
        ))}
      </div>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="card">
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-5 w-20" rounded="rounded-full" />
            </div>
            <Skeleton className="mt-3 h-3 w-1/2" />
            <div className="mt-4 flex justify-between border-t border-token pt-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-12" />
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
