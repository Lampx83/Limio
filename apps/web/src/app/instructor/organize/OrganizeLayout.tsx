import Link from "next/link";
import type { ExamRun } from "@feedbackme/core-lms";
import ExamRunsList from "./ExamRunsList";

/**
 * Khung chung cho ba trang tổ chức thi.
 *
 * Mỗi trang chia đúng hai phần: TẠO MỚI ở trên, LỊCH SỬ cùng dạng ở dưới. Tách
 * lịch sử theo hình thức chứ không gộp — ba hình thức cần thấy thông tin khác
 * nhau, và gộp lại thì bảng phải cõng mọi cột cho mọi kiểu.
 */
export default function OrganizeLayout({
  title,
  blurb,
  children,
  runs,
  historyTitle,
  emptyHint,
  showRooms = false,
}: {
  title: string;
  blurb: string;
  /** Phần tạo mới. */
  children: React.ReactNode;
  runs: ExamRun[];
  historyTitle: string;
  emptyHint: string;
  /** Chỉ kỳ thi chính thức mới có nhiều phòng để mà xem. */
  showRooms?: boolean;
}) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 lg:px-6">
      <Link href="/instructor/organize" className="text-sm text-faint hover:underline">
        ← Tổ chức thi
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{title}</h1>
      <p className="mt-1 text-body text-faint">{blurb}</p>

      <section className="mt-6 rounded-lg border border-default bg-white p-4 sm:p-5">
        {children}
      </section>

      <section className="mt-10">
        <h2 className="text-base font-semibold">
          {historyTitle}
          {runs.length > 0 && (
            <span className="ml-1 font-normal text-faint">· {runs.length}</span>
          )}
        </h2>
        <p className="mb-3 mt-0.5 text-caption text-faint">
          Bấm “Kết quả” để xem chi tiết, hoặc “Tải” để lấy file điểm của lần thi đó.
        </p>
        <ExamRunsList runs={runs} emptyHint={emptyHint} showRooms={showRooms} />
      </section>
    </main>
  );
}
