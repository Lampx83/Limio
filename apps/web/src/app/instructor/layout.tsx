import { prisma } from "@feedbackme/db";
import { userIsAnyProctor } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import InstructorLeftMenu from "@/components/InstructorLeftMenu";

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
    const [ci, proctor] = await Promise.all([
      prisma.courseInstructor.findFirst({
        where: { userId: session.user.id },
        select: { id: true },
      }),
      userIsAnyProctor(session.user.id),
    ]);
    isInstructor = ci !== null;
    isProctor = proctor;
  }
  return (
    <div className="flex w-full">
      <InstructorLeftMenu isInstructor={isInstructor} isProctor={isProctor} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
