import { Skeleton, SkeletonHeader } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <SkeletonHeader />
      <div className="mt-6 grid grid-cols-3 gap-3 sm:gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20" rounded="rounded-xl" />
        ))}
      </div>
      <ul className="mt-8 grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="card">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="mt-3 h-2 w-full" rounded="rounded-full" />
            <Skeleton className="mt-3 h-3 w-1/3" />
          </li>
        ))}
      </ul>
    </main>
  );
}
