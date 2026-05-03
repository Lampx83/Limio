import { Skeleton, SkeletonHeader } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <SkeletonHeader />
      <div className="mt-6 grid grid-cols-3 gap-3 sm:gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20" rounded="rounded-xl" />
        ))}
      </div>
      <ul className="mt-8 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i} className="card">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="mt-1 h-3 w-1/3" />
              </div>
              <Skeleton className="h-7 w-14" />
            </div>
            <Skeleton className="mt-4 h-2 w-full" rounded="rounded-full" />
          </li>
        ))}
      </ul>
    </main>
  );
}
