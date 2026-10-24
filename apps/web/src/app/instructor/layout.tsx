import type { Metadata } from "next";
import { NOINDEX } from "@/lib/seo";
import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import { isCenterTeacher, isInstructor, isResearcher, userIsAnyProctor } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import InstructorLeftMenu from "@/components/InstructorLeftMenu";
import { ActiveNavSectionProvider } from "@/lib/activeNavSection";
import InstructorContentFrame from "./InstructorContentFrame";
import { AssistantProvider } from "@/components/assistant/AssistantProvider";
import AssistantLauncher from "@/components/assistant/AssistantLauncher";
import { getInstructorCenterAccess } from "@/lib/centerAccess";
import { isTeachingOnly } from "@/lib/roleWorkspace";

// Khu vực cần đăng nhập → không bao giờ index. `middleware.ts` đã gắn
// `X-Robots-Tag` cho cùng nhóm route; thẻ meta này là lớp thứ hai, phòng khi
// trang được phục vụ qua đường không đi qua middleware (vd. reverse proxy cache).
export const metadata: Metadata = NOINDEX;


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
    const [instructor, proctor, researcher, centerTeacher] = await Promise.all([
      isInstructor(userId),
      userIsAnyProctor(userId),
      isResearcher(userId),
      isCenterTeacher(userId),
    ]);
    return { isInstructor: instructor, isProctor: proctor, isResearcher: researcher, isCenterTeacher: centerTeacher };
  },
  ["instructor-layout-roles"],
  { revalidate: 60, tags: ["user-roles"] },
);

// Khoá giảng viên chỉnh gần nhất, cho câu gợi ý "Mở khoá học …" của Lily. Chỉ cần tên, cache 60s như role.
const getRecentCourseTitle = unstable_cache(
  async (userId: string) => {
    const c = await prisma.course.findFirst({
      where: { instructors: { some: { userId } } },
      orderBy: { updatedAt: "desc" },
      select: { title: true },
    });
    return c?.title ?? null;
  },
  ["instructor-layout-recent-course"],
  { revalidate: 60 },
);

export default async function InstructorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/instructor/courses");

  const {
    isInstructor: hasInstructorRole,
    isProctor,
    isResearcher: hasResearcherRole,
    isCenterTeacher: hasCenterTeacherRole,
  } = await getInstructorRoles(session.user.id);

  // Instructor status is admin-granted (xem packages/core-lms/src/courses/courses.ts
  // createCourse — không còn tự cấp khi tạo khoá) — không có lối "tự đăng ký"
  // nào ở đây để phải chừa cửa, nên chặn cứng toàn bộ khu vực /instructor/*.
  if (!hasInstructorRole && !isProctor && !hasCenterTeacherRole) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-2xl border border-danger-100 bg-danger-50 p-5 text-sm text-danger-700">
          Chỉ giảng viên hoặc giám thị mới truy cập được khu vực này. Liên hệ
          admin để được cấp quyền giảng viên.
        </div>
      </main>
    );
  }

  const teachingOnly = isTeachingOnly(session.user.roles ?? []);
  const recentCourseTitle = hasInstructorRole ? await getRecentCourseTitle(session.user.id) : null;
  const centerEnabled = hasInstructorRole || hasCenterTeacherRole ? await getInstructorCenterAccess(session.user.id) : false;

  return (
    <ActiveNavSectionProvider>
      {/* Limio, trợ lý ảo của giảng viên: một cuộc trò chuyện dùng chung cho nút nổi ở mọi trang giảng viên. */}
      <AssistantProvider userId={session.user.id} recentCourseTitle={recentCourseTitle}>
        <div className="flex w-full">
          <InstructorLeftMenu
            isInstructor={hasInstructorRole || hasCenterTeacherRole}
            teachingOnly={teachingOnly}
            isProctor={isProctor}
            isResearcher={hasResearcherRole}
            centerEnabled={centerEnabled}
          />
          <div className="min-w-0 flex-1">
            <InstructorContentFrame>{children}</InstructorContentFrame>
          </div>
        </div>
        <AssistantLauncher />
      </AssistantProvider>
    </ActiveNavSectionProvider>
  );
}
