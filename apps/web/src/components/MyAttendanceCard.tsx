import Link from "next/link";
import { getMyAttendanceSummary } from "@feedbackme/core-lms";

/**
 * Chuyên cần của chính học viên theo từng lớp (CENTER C2.12), đặt ngay trên trang tổng quan.
 * Không có dòng điểm danh nào (lớp không dùng điểm danh) thì không hiện gì, để không thêm nhiễu cho người không cần.
 */
export default async function MyAttendanceCard({ userId }: { userId: string }) {
  const summaries = await getMyAttendanceSummary(userId).catch(() => []);
  if (summaries.length === 0) return null;

  return (
    <section className="card p-4" aria-labelledby="chuyen-can-cua-ban">
      <div className="flex items-center justify-between gap-2">
        <h2 id="chuyen-can-cua-ban" className="text-h4">
          Chuyên cần của bạn
        </h2>
        <Link href="/me/lich-hoc" className="text-sm font-medium text-lime-700 hover:underline dark:text-lime-400">
          Xem lịch học
        </Link>
      </div>
      <ul className="mt-3 space-y-2 text-sm">
        {summaries.map((s) => {
          const total = s.present + s.late + s.absent + s.excused;
          const attended = s.present + s.late;
          const pct = total === 0 ? 0 : Math.round((attended / total) * 100);
          return (
            <li key={s.sectionId}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate font-medium">{s.sectionName}</span>
                <span className="shrink-0 text-muted">
                  {attended}/{total} buổi
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[rgb(var(--surface-muted))]" aria-hidden>
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
              </div>
              {(s.late > 0 || s.absent > 0 || s.excused > 0) && (
                <p className="mt-1 text-caption text-muted">
                  {[s.late > 0 && `${s.late} buổi đi muộn`, s.absent > 0 && `vắng ${s.absent}`, s.excused > 0 && `vắng có phép ${s.excused}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
