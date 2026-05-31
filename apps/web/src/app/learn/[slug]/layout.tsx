import { auth } from "@/lib/auth";
import StudentLeftMenu from "@/components/StudentLeftMenu";
import StudentMenuTrigger from "@/components/StudentMenuTrigger";
import { getStudentMenuBadges, getStudentMenuContinue } from "@/lib/studentMenuBadges";

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
