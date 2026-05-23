import { SkeletonHeader, SkeletonGrid } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main>
      <SkeletonHeader />
      <div className="mt-8">
        <SkeletonGrid count={6} />
      </div>
    </main>
  );
}
