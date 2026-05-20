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

export function SkeletonList({
  rows = 5,
  withAvatar = false,
}: {
  rows?: number;
  withAvatar?: boolean;
}) {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg border border-token bg-[rgb(var(--surface))] px-4 py-3"
        >
          {withAvatar && (
            <Skeleton className="h-10 w-10 shrink-0" rounded="rounded-full" />
          )}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-7 w-16" rounded="rounded-md" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({
  rows = 5,
  cols = 4,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div
      className="overflow-hidden rounded-xl border border-token bg-[rgb(var(--surface))]"
      aria-hidden
    >
      <div
        className="grid border-b border-token bg-[rgb(var(--surface-muted))] px-4 py-3"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-3/4" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="grid border-b border-token px-4 py-3 last:border-b-0"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={`h-3 ${c === 0 ? "w-2/3" : "w-1/2"}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonGrid({
  count = 6,
  cardClassName = "",
}: {
  count?: number;
  cardClassName?: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} className={cardClassName} />
      ))}
    </div>
  );
}
