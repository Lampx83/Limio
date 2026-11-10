import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import StudentLeftMenu from "@/components/StudentLeftMenu";
import { getActiveRole } from "@/lib/active-role";
import { isLearnerRole } from "@/lib/learnerRole";
import { getStudentMenuContext } from "@/lib/studentMenuContext";

export const dynamic = "force-dynamic";

/**
 * Khu Limio Language: trang giới thiệu (khách) và Lịch ôn tập (tạm không có liên kết). Học viên đã đăng nhập dùng đúng menu học viên như
 * mọi trang khác (không còn menu/vỏ riêng — docs/tieu-chi/limio-language-gop-menu.md). Khách chỉ thấy trang giới thiệu,
 * không có menu. Trang giới thiệu có thể được index; phần theo người dùng là riêng tư (từng trang tự đặt `NOINDEX`).
 * Giảng viên/admin được trang của khu này chuyển về khu của họ nên không có menu ở đây.
 */
export async function generateMetadata(): Promise<Metadata> {
  return { title: "Limio Language" };
}

export default async function LanguageLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id || !isLearnerRole(getActiveRole(session.user.roles ?? []))) return <>{children}</>;
  const menu = await getStudentMenuContext(session.user.id);
  return (
    <div className="flex w-full">
      <StudentLeftMenu badges={menu.badges} continueTo={menu.continueTo} showSchedule={menu.showSchedule} showGoals={menu.showGoals} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
