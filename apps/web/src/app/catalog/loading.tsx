import { Skeleton, SkeletonHeader } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <SkeletonHeader />
      <Skeleton className="mt-8 h-16 w-full" rounded="rounded-2xl" />
      <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="card">
            <Skeleton className="-m-5 mb-4 h-24" rounded="rounded-t-xl" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="mt-2 h-3 w-full" />
            <Skeleton className="mt-1 h-3 w-5/6" />
            <Skeleton className="mt-1 h-3 w-2/3" />
          </li>
        ))}
      </ul>
    </main>
  );
}
