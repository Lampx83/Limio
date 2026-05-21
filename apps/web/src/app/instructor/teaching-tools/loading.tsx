import { SkeletonHeader, SkeletonGrid } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <SkeletonHeader />
      <div className="mt-8">
        <SkeletonGrid count={6} />
      </div>
    </main>
  );
}
