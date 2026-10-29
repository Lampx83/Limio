import Link from "next/link";
import { UserAvatar } from "@/components/ui";
import { formatRelative } from "@/lib/datetime";
import type { FeedItem } from "@/lib/classFeed";

/**
 * Khối "Lớp đang học gì" ở trang chủ giảng viên: vài dòng chữ nhẹ, không khung, không bóng, để trang chủ
 * giữ vẻ thoáng. Mỗi dòng một hàng; tên khoá nằm ở tooltip. Chi tiết từng khoá nằm ở nút
 * "Log hoạt động học viên" của tab Học viên.
 */
export default function ClassFeed({ items }: { items: FeedItem[] }) {
  if (items.length === 0) return null;
  const now = new Date();
  return (
    <section className="mt-10 sm:mt-12" aria-labelledby="class-feed-heading">
      <h2 id="class-feed-heading" className="mx-1 text-base font-semibold">Lớp đang học gì</h2>
      <ul className="mt-2.5">
        {items.map((it) => {
          const body = (
            <>
              <span className="flex shrink-0 -space-x-1.5" aria-hidden>
                {it.people.map((p) => (
                  <UserAvatar
                    key={p.userId}
                    name={p.name}
                    imageUrl={p.avatarUrl}
                    size="xs"
                    className="ring-2 ring-[rgb(var(--bg))]"
                  />
                ))}
              </span>
              <span className="min-w-0 flex-1 truncate text-[0.9375rem] text-muted">
                <span className="font-medium text-[rgb(var(--text))]">{it.names}</span> {it.phrase}
                {it.target && <> <span className="font-medium text-[rgb(var(--text))]">{it.target}</span></>}
              </span>
              <span className="shrink-0 text-[0.8125rem] tabular-nums text-faint">
                {formatRelative(it.occurredAt, now)}
              </span>
            </>
          );
          const cls = "flex items-center gap-2.5 rounded-xl px-1 py-2";
          return (
            <li key={it.key}>
              {it.courseId ? (
                <Link
                  href={`/instructor/courses/${it.courseId}`}
                  prefetch={false}
                  title={it.courseTitle ?? undefined}
                  className={`${cls} transition-colors hover:bg-[rgb(var(--surface))]`}
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
