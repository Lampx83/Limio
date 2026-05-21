import { SkeletonHeader, SkeletonGrid, SkeletonChip } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <SkeletonHeader />
      <div className="mt-6 flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonChip key={i} />
        ))}
      </div>
      <div className="mt-8">
        <SkeletonGrid count={6} />
      </div>
    </main>
  );
}
