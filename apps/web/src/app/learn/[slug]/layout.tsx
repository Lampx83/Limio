import StudentLeftMenu from "@/components/StudentLeftMenu";
import StudentMenuTrigger from "@/components/StudentMenuTrigger";

export default function LearnLessonLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <StudentLeftMenu desktopSidebar={false} />
      <StudentMenuTrigger variant="floating" />
      {children}
    </>
  );
}
