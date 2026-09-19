import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import { isInstructor, userIsAnyProctor } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import InstructorLeftMenu from "@/components/InstructorLeftMenu";
import { ActiveNavSectionProvider } from "@/lib/activeNavSection";
import InstructorContentFrame from "./InstructorContentFrame";

// Role membership (instructor / proctor) ít khi đổi → cache 60s per userId
// để tránh chạy 2 query Prisma trên mọi navigation trong khu vực giảng viên.
// Khi user được cấp role mới, chấp nhận delay tối đa 60s — đổi role là thao
// tác admin hiếm, không phải hot path.
//
// Dùng `isInstructor()` (role toàn cục, cấp bởi admin) chứ không phải "đã có
// CourseInstructor row nào chưa" — nếu dùng cách sau, một người vừa được
// admin cấp role Instructor nhưng chưa tạo khoá nào sẽ bị chặn ngay cả khi
// tạo khoá đầu tiên, tự khoá luôn lối vào hợp lệ duy nhất.
const getInstructorRoles = unstable_cache(
  async (userId: string) => {
    const [instructor, proctor] = await Promise.all([
      isInstructor(userId),
      userIsAnyProctor(userId),
    ]);
    return { isInstructor: instructor, isProctor: proctor };
  },
  ["instructor-layout-roles"],
  { revalidate: 60, tags: ["user-roles"] },
);

export default async function InstructorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/instructor/courses");

  const { isInstructor: hasInstructorRole, isProctor } = await getInstructorRoles(
    session.user.id,
  );

  // Instructor status is admin-granted (xem packages/core-lms/src/courses/courses.ts
  // createCourse — không còn tự cấp khi tạo khoá) — không có lối "tự đăng ký"
  // nào ở đây để phải chừa cửa, nên chặn cứng toàn bộ khu vực /instructor/*.
  if (!hasInstructorRole && !isProctor) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-2xl border border-danger-100 bg-danger-50 p-5 text-sm text-danger-700">
          Chỉ giảng viên hoặc giám thị mới truy cập được khu vực này. Liên hệ
          admin để được cấp quyền giảng viên.
        </div>
      </main>
    );
  }

  return (
    <ActiveNavSectionProvider>
      <div className="flex w-full">
        <InstructorLeftMenu isInstructor={hasInstructorRole} isProctor={isProctor} />
        <div className="min-w-0 flex-1">
          <InstructorContentFrame>{children}</InstructorContentFrame>
        </div>
      </div>
    </ActiveNavSectionProvider>
  );
}
