import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isTeachingOnly } from "@/lib/roleWorkspace";

/** Trang tạo khoá là client component nên chặn giảng viên trung tâm (chỉ dạy) ở layout phía máy chủ. */
export default async function NewCourseLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (session?.user?.id && isTeachingOnly(session.user.roles ?? [])) redirect("/instructor/dashboard");
  return <>{children}</>;
}
