import { isLessonPrintBlocked } from "@feedbackme/core-lms";
import { getT } from "@/lib/i18n/server";
import PrintBlock from "@/components/lesson/PrintBlock";

/**
 * Chặn in cho mọi trang dưới một bài học (bài học, slide, bản in) khi khoá bật "Học liệu có bản quyền"
 * (docs/tieu-chi/chan-in-hoc-lieu-ban-quyen.md, AC2–AC3). Đặt ở layout để không phải nhớ nhúng ở từng
 * nhánh `return` của trang bài (có bốn nhánh) và để trang mới dưới cụm này được phủ sẵn.
 *
 * Khoá không bật cờ: không render gì thêm. Lỗi tra cờ thì KHÔNG chặn hiển thị trang (đây là lớp làm khó
 * người dùng thường; chỗ chặn chắc là trang `/print` tự tra cờ ở máy chủ).
 */
export default async function LessonPrintGuardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string; lessonId: string };
}) {
  let blocked = false;
  try {
    blocked = await isLessonPrintBlocked(params.lessonId);
  } catch {
    blocked = false;
  }
  const tx = blocked ? await getT() : null;
  return (
    <>
      {blocked && tx && <PrintBlock message={tx("learn.print.blockedStrip")} />}
      {children}
    </>
  );
}
