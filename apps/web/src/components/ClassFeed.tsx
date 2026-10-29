import Link from "next/link";
import { UserAvatar } from "@/components/ui";
import { formatRelative } from "@/lib/datetime";
import type { FeedItem } from "@/lib/classFeed";

/**
 * Khối "Lớp đang học gì" ở trang chủ giảng viên: vài dòng tin ngắn về học viên, đọc lướt cho có cảm giác
 * lớp đang sống. Chi tiết từng khoá nằm ở nút "Log hoạt động học viên" của tab Học viên.
 */
export default function ClassFeed({ items }: { items: FeedItem[] }) {
  if (items.length === 0) return null;
  const now = new Date();
  return (
    <section className="mt-10 sm:mt-12" aria-labelledby="class-feed-heading">
      <header className="mx-1">
        <h2 id="class-feed-heading" className="text-base font-semibold">Lớp đang học gì</h2>
        <p className="text-meta mt-0.5">Những gì học viên của thầy/cô vừa làm trong 7 ngày qua.</p>
      </header>
      <ul className="mt-3.5 divide-y divide-[rgb(var(--border))] overflow-hidden rounded-[22px] border border-token bg-[rgb(var(--surface))] shadow-[0_6px_20px_-10px_rgb(29_36_23/0.14)]">
        {items.map((it) => {
          const body = (
            <>
              <span className="flex shrink-0 -space-x-2" aria-hidden>
                {it.people.map((p) => (
                  <UserAvatar
                    key={p.userId}
                    name={p.name}
                    imageUrl={p.avatarUrl}
                    size="sm"
                    className="ring-2 ring-[rgb(var(--surface))]"
                  />
                ))}
              </span>
              <span className="min-w-0 flex-1 text-[0.9375rem] leading-snug">
                <strong className="font-semibold">{it.names}</strong> {it.phrase}
                {it.target && <> <strong className="font-semibold">{it.target}</strong></>}
                <span className="mt-0.5 block truncate text-[0.8125rem] text-muted">
                  {it.courseTitle ? `${it.courseTitle} · ` : ""}
                  {formatRelative(it.occurredAt, now)}
                </span>
              </span>
            </>
          );
          const cls = "flex items-center gap-3 px-4 py-3";
          return (
            <li key={it.key}>
              {it.courseId ? (
                <Link
                  href={`/instructor/courses/${it.courseId}`}
                  prefetch={false}
                  className={`${cls} transition-colors hover:bg-[rgb(var(--surface-muted))]`}
                >
                  {body}
                </Link>
              ) : (
                <div className={cls}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
