import Link from "next/link";
import { History } from "lucide-react";

/**
 * Khung chung cho ba trang tổ chức thi.
 *
 * Chỉ còn phần TẠO MỚI. Các lần thi — đang mở lẫn đã đóng, kèm Giám sát / Kết quả / Đóng ca — nằm ở
 * Lịch sử thi (một chỗ cho mọi hình thức, chia tab); ở đây chỉ còn một lối sang đúng tab. Mã và QR
 * của link vừa mở đã hiện ngay trong form tạo, nên không cần danh sách thẻ để lấy mã.
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
          Xem và quản lý các lần thi trong Lịch sử thi →
        </Link>
      </p>
    </main>
  );
}
