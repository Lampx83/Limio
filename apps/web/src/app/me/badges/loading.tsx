import { Skeleton, SkeletonHeader } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <SkeletonHeader />
      <Skeleton className="mt-5 h-2 w-64" rounded="rounded-full" />

      <div className="mt-10">
        <Skeleton className="h-5 w-40" />
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" rounded="rounded-2xl" />
          ))}
        </ul>
      </div>
    </main>
  );
}
