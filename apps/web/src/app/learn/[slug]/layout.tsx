import { auth } from "@/lib/auth";
import StudentLeftMenu from "@/components/StudentLeftMenu";
import StudentMenuTrigger from "@/components/StudentMenuTrigger";
import { getStudentMenuBadges } from "@/lib/studentMenuBadges";

export default async function LearnLessonLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const badges = await getStudentMenuBadges(session?.user?.id);
  return (
    <>
      <StudentLeftMenu desktopSidebar={false} badges={badges} />
      <StudentMenuTrigger variant="floating" />
      {children}
    </>
  );
}
