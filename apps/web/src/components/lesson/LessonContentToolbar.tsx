import { Printer } from "lucide-react";
import { tFor } from "@/lib/i18n/tFor";
import type { UiLang } from "@/lib/i18n/core";

/**
 * Nút công cụ của bài học.
 *
 * Trước đây ở đây còn một nút "Toàn màn hình" phóng khối nội dung bằng
 * Fullscreen API. Đã bỏ: chế độ trình chiếu của giảng viên đã lo phần chiếu
 * lên máy chiếu, còn người học đọc bài thì cuộn là đủ — một nút nữa ở đầu bài
 * chỉ làm loãng hai thứ họ thật sự cần: tên bài và nội dung.
 *
 * Không tự bọc thanh riêng — nó được xếp vào hàng nút ngay dưới tên bài.
 */
export default function LessonContentToolbar({
  printHref,
  className = "btn-pill",
  lang,
}: {
  printHref: string;
  /** Kiểu nút — mặc định đồng bộ với các nút còn lại của bài. */
  className?: string;
  lang?: UiLang;
}) {
  return (
    <a
      href={printHref}
      target="_blank"
      rel="noopener noreferrer"
      className={`${className} print:hidden`}
    >
      <Printer size={16} />
      {tFor(lang)("learn.printPdf")}
    </a>
  );
}
