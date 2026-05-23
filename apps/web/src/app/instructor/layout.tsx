import { unstable_cache } from "next/cache";
import { prisma } from "@feedbackme/db";
import { userIsAnyProctor } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import InstructorLeftMenu from "@/components/InstructorLeftMenu";

// Role membership (instructor / proctor) ít khi đổi → cache 60s per userId
// để tránh chạy 2 query Prisma trên mọi navigation trong khu vực giảng viên.
// Khi user được cấp role mới, chấp nhận delay tối đa 60s — đổi role là thao
// tác admin hiếm, không phải hot path.
const getInstructorRoles = unstable_cache(
  async (userId: string) => {
    const [ci, proctor] = await Promise.all([
      prisma.courseInstructor.findFirst({
        where: { userId },
        select: { id: true },
      }),
      userIsAnyProctor(userId),
    ]);
    return { isInstructor: ci !== null, isProctor: proctor };
  },
  ["instructor-layout-roles"],
  { revalidate: 60, tags: ["user-roles"] },
);

export default async function InstructorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Detect role flags server-side so the menu can render the right shape.
  // A user who is only a proctor (never instructor of any course) gets a
  // slimmer menu with just "Giám sát phòng thi"; instructors see the full menu
  // with that item added when relevant.
  const session = await auth();
  let isInstructor = false;
  let isProctor = false;
  if (session?.user?.id) {
    ({ isInstructor, isProctor } = await getInstructorRoles(session.user.id));
  }
  return (
    <div className="flex w-full">
      <InstructorLeftMenu isInstructor={isInstructor} isProctor={isProctor} />
      <div className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-6">
          {children}
        </div>
      </div>
    </div>
  );
}
