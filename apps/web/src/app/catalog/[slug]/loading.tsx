import { Skeleton, SkeletonText } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-4 h-64 w-full" rounded="rounded-2xl" />
      <div className="mt-10 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card">
            <Skeleton className="h-5 w-1/3" />
            <SkeletonText lines={3} className="mt-3" />
          </div>
        ))}
      </div>
    </main>
  );
}
