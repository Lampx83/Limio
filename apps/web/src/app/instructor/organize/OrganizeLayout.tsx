import Link from "next/link";
import { History } from "lucide-react";

/**
 * Khung chung cho ba trang tổ chức thi.
 *
 * Trang này CHỈ để cấu hình/tạo mới. Mọi lần thi đã tổ chức — đang mở hay đã
 * đóng — nằm ở Lịch sử thi, một chỗ cho mọi hình thức (chia tab). Vừa tạo xong
 * thì mã/QR hiện ngay trong chính form (xem QuickExamForm); quay lại sau đó
 * thì chỉ có một lối sang đúng tab của hình thức này, không liệt kê lại ca ở
 * đây — cùng một ca hiện ở hai nơi là hai lối vào cho một việc.
 */
export default function OrganizeLayout({
  title,
  blurb,
  children,
  historyType,
}: {
  title: string;
  blurb: string;
  /** Phần tạo mới / cấu hình. */
  children: React.ReactNode;
  /** Tab tương ứng ở trang Lịch sử thi. */
  historyType: "quick" | "field-test" | "formal";
}) {
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

      <p className="mt-6">
        <Link
          href={`/instructor/exam-history?type=${historyType}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
        >
          <History className="h-4 w-4" aria-hidden />
          Xem các lần đã tổ chức trong Lịch sử thi →
        </Link>
      </p>
    </main>
  );
}
