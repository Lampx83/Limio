import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Danh sách đợt thi đã chuyển vào Tổ chức thi › Kỳ thi chính thức — một chỗ
 * duy nhất cấu hình đợt. Giữ route này để link/bookmark cũ vẫn dùng được.
 * Các trang con (`/exam-rounds/[id]/…`) vẫn ở đây: đó là màn quản lý một đợt.
 */
export default function ExamRoundsRedirect({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const q = searchParams.status ? `?status=${encodeURIComponent(searchParams.status)}` : "";
  redirect(`/instructor/organize/formal${q}`);
}
