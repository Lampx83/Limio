import { Skeleton, SkeletonList } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6 pb-28 lg:pb-10">
      <Skeleton className="h-4 w-24" />

      {/* Hero — cùng khung bo góc + nhịp nội dung với header thật, tránh
          nhảy layout khi RSC trả dữ liệu xong. */}
      <div className="mt-4 rounded-2xl bg-[rgb(var(--surface-muted))] p-8 sm:p-10" aria-hidden>
        <Skeleton className="h-5 w-20" rounded="rounded-full" />
        <Skeleton className="mt-4 h-9 w-2/3" />
        <Skeleton className="mt-3 h-4 w-1/3" />
        <div className="mt-6 flex gap-3">
          <Skeleton className="h-14 w-24" rounded="rounded-xl" />
          <Skeleton className="h-14 w-24" rounded="rounded-xl" />
        </div>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        {/* Curriculum — main column */}
        <section className="lg:col-span-2">
          <div className="flex items-baseline justify-between">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-20" />
          </div>
          <ol className="mt-4 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <li key={i} className="card">
                <div className="flex items-baseline justify-between gap-3 border-b border-token pb-3">
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="h-3 w-10" />
                </div>
                <div className="mt-3 space-y-2">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} className="flex items-center gap-3 px-2 py-1.5">
                      <Skeleton className="h-6 w-6 shrink-0" rounded="rounded-full" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Sidebar TOC — leaderboard + enroll box */}
        <aside className="lg:col-span-1">
          <div className="space-y-4">
            <div className="card">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-12" />
              </div>
              <div className="mt-3">
                <SkeletonList rows={5} withAvatar />
              </div>
            </div>
            <div className="card">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-11 w-full" rounded="rounded-xl" />
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
