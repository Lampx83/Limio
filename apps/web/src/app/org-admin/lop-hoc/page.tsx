import Link from "next/link";
import { redirect } from "next/navigation";
import { isAnyOrgAdmin } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import { listManagedOrgs } from "@/lib/orgAdminOrgs";
import EmptyState from "@/components/ui/EmptyState";
import InstructorsSection from "@/app/instructor/courses/[id]/InstructorsSection";
import OrgClassesPanel from "./OrgClassesPanel";

export const dynamic = "force-dynamic";

/**
 * Lớp và giáo viên của trường (CENTER, xếp lớp): người điều hành trung tâm không dạy vẫn dựng lớp, thêm hoặc gỡ giáo viên của khoá
 * và chọn giáo viên phụ trách từng lớp. Quyền ở máy chủ: `assertCanRunSections` (core-lms) và `assertCanManageInstructors`.
 */
export default async function OrgClassesPage({ searchParams }: { searchParams: { khoa?: string; truong?: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/org-admin/lop-hoc");
  const userId = session.user.id;
  if (!(await isAnyOrgAdmin(userId))) {
    return <EmptyState title="Không có quyền" description="Bạn cần là quản trị viên trường để xem trang này." />;
  }
  const orgs = await listManagedOrgs(userId);
  if (orgs.length === 0) return <EmptyState title="Chưa được gán trường nào" description="Bạn chưa được gán làm quản trị viên cho trường nào." />;
  const org = orgs.find((o) => o.id === searchParams.truong) ?? orgs[0]!;
  const courses = await prisma.course.findMany({
    where: { organizationId: org.id, status: { not: "archived" } },
    select: { id: true, title: true, status: true },
    orderBy: { title: "asc" },
  });
  const course = courses.find((c) => c.id === searchParams.khoa) ?? courses[0] ?? null;
  const orgQuery = orgs.length > 1 ? `&truong=${org.id}` : "";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="h-display text-2xl font-bold">Lớp và giáo viên</h1>
        <span className="chip-brand">OrgAdmin</span>
      </div>
      <p className="mt-1 text-sm text-muted">{org.name}: dựng lớp, chọn giáo viên phụ trách và thêm hoặc gỡ giáo viên của khoá. Nội dung bài giảng do chủ khoá soạn.</p>

      {orgs.length > 1 && (
        <nav className="mt-3 flex flex-wrap items-center gap-2 text-sm" aria-label="Chọn trường">
          <span className="text-muted">Trường</span>
          {orgs.map((o) => (
            <Link key={o.id} href={`/org-admin/lop-hoc?truong=${o.id}`} aria-current={o.id === org.id ? "page" : undefined} className={`btn-pill ${o.id === org.id ? "!bg-brand-500 !text-white" : ""}`}>
              {o.name}
            </Link>
          ))}
        </nav>
      )}

      {!course ? (
        <div className="mt-6">
          <EmptyState title="Trường chưa có khoá học" description="Khoá học được gắn vào trường bởi quản trị nền tảng, hoặc tạo từ gói học liệu ở mục Giáo trình của giảng viên." />
        </div>
      ) : (
        <>
          <nav className="mt-4 flex flex-wrap items-center gap-2 text-sm" aria-label="Chọn khoá">
            <span className="text-muted">Khoá</span>
            {courses.map((c) => (
              <Link key={c.id} href={`/org-admin/lop-hoc?khoa=${c.id}${orgQuery}`} aria-current={c.id === course.id ? "page" : undefined} className={`btn-pill ${c.id === course.id ? "!bg-brand-500 !text-white" : ""}`}>
                {c.title}
                {c.status === "draft" && <span className="text-xs opacity-70">(nháp)</span>}
              </Link>
            ))}
          </nav>

          <div className="mt-6 grid gap-8 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <section aria-labelledby="lop-hoc-h">
              <h2 id="lop-hoc-h" className="mb-3 text-lg font-semibold">Lớp của khoá</h2>
              <OrgClassesPanel key={course.id} courseId={course.id} />
            </section>
            <section aria-labelledby="gv-h">
              <h2 id="gv-h" className="mb-3 text-lg font-semibold">Giáo viên của khoá</h2>
              <InstructorsSection key={course.id} courseId={course.id} isOwner />
            </section>
          </div>
        </>
      )}
    </div>
  );
}
