import { Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-4 h-56 w-full" rounded="rounded-2xl" />

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          <Skeleton className="h-6 w-40" />
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="card">
              <Skeleton className="h-5 w-2/3" />
              <div className="mt-4 space-y-2">
                {Array.from({ length: 4 }).map((_, j) => (
                  <Skeleton key={j} className="h-6 w-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
        <aside className="space-y-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48" rounded="rounded-xl" />
          ))}
        </aside>
      </div>
    </main>
  );
}
