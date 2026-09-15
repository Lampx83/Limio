import { auth } from "@/lib/auth";
import StudentLeftMenu from "@/components/StudentLeftMenu";
import InstructorLeftMenu from "@/components/InstructorLeftMenu";
import AdminSidebar from "@/app/admin/_components/AdminSidebar";
import { getStudentMenuBadges, getStudentMenuContinue } from "@/lib/studentMenuBadges";
import { getActiveRole } from "@/lib/active-role";

// /me/* là các trang dùng chung mọi role (ví dụ Token AI, Cài đặt tài khoản)
// — cả StudentLeftMenu lẫn InstructorLeftMenu đều trỏ "Token AI" về đây.
// Layout này trước đó luôn gắn cứng StudentLeftMenu, nên một Giảng viên/Admin
// bấm vào từ menu của họ vẫn hạ cánh dưới sidebar "Học viên": badge trên
// header đúng vai trò đang active, nhưng cột trái nói ngược lại — trông y hệt
// việc chuyển role bị lỗi dù cookie/API đã đổi đúng.
export default async function MeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const roles = session?.user?.roles ?? [];
  const activeRole = getActiveRole(roles);

  const isStudentWorkspace = activeRole !== "instructor" && activeRole !== "admin";
  const [badges, continueTo] = isStudentWorkspace
    ? await Promise.all([
        getStudentMenuBadges(session?.user?.id),
        getStudentMenuContinue(session?.user?.id),
      ])
    : [{}, null];

  const leftMenu =
    activeRole === "admin" ? (
      <AdminSidebar />
    ) : activeRole === "instructor" ? (
      <InstructorLeftMenu />
    ) : (
      <StudentLeftMenu badges={badges} continueTo={continueTo} />
    );

  return (
    <div className="flex w-full">
      {leftMenu}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
