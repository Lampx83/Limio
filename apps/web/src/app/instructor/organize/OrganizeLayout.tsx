import Link from "next/link";
import { History } from "lucide-react";
import type { ExamRun } from "@feedbackme/core-lms";
import ExamRunsList from "./ExamRunsList";

/**
 * Khung chung cho ba trang tổ chức thi.
 *
 * Trên: TẠO MỚI. Dưới: chỉ các ca CÙNG DẠNG còn ĐANG MỞ — vừa bấm mở link
 * nhanh là cần mã/QR ngay tại chỗ, không bắt chạy sang trang khác. Các lần đã
 * đóng nằm ở Lịch sử thi (một chỗ cho mọi hình thức, chia tab), nên ở đây chỉ
 * còn một lối sang đúng tab của hình thức này.
 */
export default function OrganizeLayout({
  title,
  blurb,
  children,
  runs,
  historyType,
  showRooms = false,
}: {
  title: string;
  blurb: string;
  /** Phần tạo mới. */
  children: React.ReactNode;
  runs: ExamRun[];
  /** Tab tương ứng ở trang Lịch sử thi. */
  historyType: "quick" | "field-test" | "formal";
  /** Chỉ kỳ thi chính thức mới có nhiều phòng để mà xem. */
  showRooms?: boolean;
}) {
  const open = runs.filter((r) => r.isOpen);
  const historyLink = (
    <Link
      href={`/instructor/exam-history?type=${historyType}`}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
    >
      <History className="h-4 w-4" aria-hidden />
      Xem các lần đã thi trong Lịch sử thi →
    </Link>
  );

  return (
    <main>
      <Link href="/instructor/organize" className="text-sm text-faint hover:underline">
        ← Tổ chức thi
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{title}</h1>
      <p className="mt-1 text-body text-faint">{blurb}</p>

      <section className="mt-6 rounded-lg border border-token bg-white p-4 sm:p-5">
        {children}
      </section>

      <section className="mt-10">
        {open.length > 0 ? (
          <>
            <ExamRunsList runs={open} showRooms={showRooms} />
            <div className="mt-4">{historyLink}</div>
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-token px-4 py-3">
            <p className="text-sm text-faint">Không có ca nào đang mở.</p>
            {historyLink}
          </div>
        )}
      </section>
    </main>
  );
}
