import type { Metadata } from "next";
import { NOINDEX } from "@/lib/seo";
import { auth } from "@/lib/auth";
import StudentLeftMenu from "@/components/StudentLeftMenu";
import StudentMenuTrigger from "@/components/StudentMenuTrigger";
import { getStudentMenuBadges, getStudentMenuContinue } from "@/lib/studentMenuBadges";

// Khu vực cần đăng nhập → không bao giờ index. `middleware.ts` đã gắn
// `X-Robots-Tag` cho cùng nhóm route; thẻ meta này là lớp thứ hai, phòng khi
// trang được phục vụ qua đường không đi qua middleware (vd. reverse proxy cache).
export const metadata: Metadata = NOINDEX;


export default async function LearnLessonLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const [badges, continueTo] = await Promise.all([
    getStudentMenuBadges(session?.user?.id),
    getStudentMenuContinue(session?.user?.id),
  ]);
  return (
    <>
      <StudentLeftMenu desktopSidebar={false} badges={badges} continueTo={continueTo} />
      <StudentMenuTrigger variant="floating" />
      {children}
    </>
  );
}
