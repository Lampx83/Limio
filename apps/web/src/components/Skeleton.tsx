/**
 * Lightweight skeleton primitives. Use as building blocks inside loading.tsx
 * route boundaries or wherever a fetch-heavy panel needs a placeholder.
 */
export function Skeleton({
  className = "",
  rounded = "rounded-md",
}: {
  className?: string;
  rounded?: string;
}) {
  return (
    <div
      className={`animate-pulse bg-[rgb(var(--surface-muted))] ${rounded} ${className}`}
      aria-hidden
    />
  );
}

export function SkeletonText({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-3 ${i === lines - 1 ? "w-2/3" : "w-full"}`}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`card ${className}`} aria-hidden>
      <Skeleton className="h-5 w-1/2" />
      <SkeletonText lines={3} className="mt-3" />
    </div>
  );
}

export function SkeletonChip() {
  return <Skeleton className="h-5 w-20" rounded="rounded-full" />;
}

export function SkeletonHeader() {
  return (
    <div aria-hidden>
      <SkeletonChip />
      <Skeleton className="mt-3 h-9 w-2/3" />
      <Skeleton className="mt-2 h-4 w-1/2" />
    </div>
  );
}
