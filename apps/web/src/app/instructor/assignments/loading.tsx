import { SkeletonHeader, SkeletonTable, SkeletonChip } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main>
      <SkeletonHeader />
      <div className="mt-6 flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonChip key={i} />
        ))}
      </div>
      <div className="mt-6">
        <SkeletonTable rows={8} cols={5} />
      </div>
    </main>
  );
}
