import Link from "next/link";
import type { Metadata } from "next";
import { NOINDEX } from "@/lib/seo";

// Trang 404 không bao giờ được index. Next đã trả đúng status 404 nên Google sẽ
// tự loại; khai thêm cho chắc, phòng trường hợp có proxy nào đó nuốt status.
export const metadata: Metadata = { title: "Không tìm thấy trang", ...NOINDEX };

/**
 * 404 có lối đi tiếp, thay vì trang trắng mặc định của Next.
 *
 * Slug khoá học đổi thì link cũ trên Google chết theo — người dùng đến đây từ
 * kết quả tìm kiếm phải có đường sang catalog, nếu không họ quay lại Google
 * (tín hiệu xấu) và crawler thì gặp ngõ cụt.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center px-6 py-24 text-center">
      <p className="h-display text-6xl font-bold text-brand-500">404</p>
      <h1 className="mt-4 h-display text-2xl font-bold sm:text-3xl">
        Không tìm thấy trang này
      </h1>
      <p className="mt-3 text-muted">
        Đường dẫn có thể đã đổi hoặc nội dung không còn được chia sẻ công khai.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/catalog" className="btn-primary btn-lg">
          Xem tất cả khoá học
        </Link>
        <Link href="/" className="btn-secondary btn-lg">
          Về trang chủ
        </Link>
      </div>
    </main>
  );
}
