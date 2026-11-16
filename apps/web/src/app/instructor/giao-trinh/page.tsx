import Link from "next/link";
import { redirect } from "next/navigation";
import { CoursePackError, listCourseSessionPlanSummaries, listPublishedPacks, type PackSummary } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { getInstructorCenterAccess } from "@/lib/centerAccess";
import EmptyState from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

const LANGUAGE_LABEL: Record<string, string> = { zh: "Tiếng Trung", en: "Tiếng Anh", ko: "Tiếng Hàn", ja: "Tiếng Nhật", vi: "Tiếng Việt" };
const STATUS_LABEL: Record<string, string> = { draft: "Nháp", review: "Chờ duyệt", published: "Đã publish" };

/**
 * Menu "Giáo trình" (CENTER K): phân phối chương trình của từng khoá — xếp bài vào buổi, rồi lịch dạy và lịch học tự hiện
 * bài của từng buổi. Cuối trang là thư viện giáo trình dựng sẵn (C3), chỉ hiện khi có giáo trình.
 */
export default async function GiaoTrinhPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/instructor/giao-trinh");
  const userId = session.user.id;

  // Tính năng trung tâm chưa bật cho tài khoản này: không có trang để xem.
  if (!(await getInstructorCenterAccess(userId))) redirect("/instructor/dashboard");

  const [courses, packs] = await Promise.all([
    listCourseSessionPlanSummaries(userId),
    listPublishedPacks(userId).catch((e: unknown): PackSummary[] => {
      // Người chỉ dạy (không có vai trò giảng viên) không dùng được thư viện giáo trình dựng sẵn.
      if (e instanceof CoursePackError && e.code === "forbidden") return [];
      throw e;
    }),
  ]);

  return (
    <main>
      <h1 className="text-h1">Giáo trình</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Xếp bài của khoá vào từng buổi học. Mọi lớp của khoá theo cùng phân phối này: lịch dạy của giáo viên và lịch học của học
        viên hiện đúng bài của từng buổi, bấm vào là mở bài.
      </p>

      {courses.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Thầy/cô chưa có khoá học nào"
            description="Tạo khoá và soạn bài trước, rồi quay lại đây để xếp bài vào từng buổi."
            actions={[{ label: "Khoá học của tôi", href: "/instructor/courses", variant: "secondary" }]}
          />
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <li key={c.courseId} className="card flex flex-col p-5">
              <p className="text-meta">
                {STATUS_LABEL[c.status] ?? c.status}
                {!c.editable && " · chỉ xem"}
              </p>
              <h2 className="mt-1 text-h4">{c.title}</h2>
              <p className="mt-2 flex-1 text-sm text-muted">
                {c.source === "plan"
                  ? `${c.sessions} buổi · ${c.unplannedLessons > 0 ? `còn ${c.unplannedLessons} bài chưa xếp` : "đã xếp mọi bài"}`
                  : c.source === "chapters"
                    ? `${c.sessions} buổi theo chương · ${c.lessons} bài`
                    : `Chưa phân phối · ${c.lessons} bài`}
              </p>
              <Link
                href={`/instructor/giao-trinh/khoa/${c.courseId}`}
                className={`${c.editable ? "btn-primary" : "btn-secondary"} mt-4 text-center`}
              >
                {c.editable ? "Phân phối chương trình" : "Xem phân phối chương trình"}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {packs.length > 0 && (
        <section className="mt-12">
          <h2 className="text-h3">Giáo trình dựng sẵn</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Giáo án từng buổi đã soạn sẵn. Thầy/cô chọn một giáo trình, Limio sao về thành khoá của thầy/cô để chỉnh theo lớp mình;
            bản gốc không bị ảnh hưởng.
          </p>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {packs.map((p) => (
              <li key={p.id} className="card flex flex-col p-5">
                <p className="text-meta">
                  {LANGUAGE_LABEL[p.language] ?? p.language}
                  {p.outcomeLevel ? ` · đầu ra ${p.outcomeLevel}` : ""}
                </p>
                <h3 className="mt-1 text-h4">{p.title}</h3>
                <p className="mt-2 flex-1 text-sm text-muted">{p.summary}</p>
                <p className="mt-3 text-sm">
                  {p.sessionCount} buổi · {p.lessonCount} bài
                </p>
                <Link href={`/instructor/giao-trinh/${p.id}`} className="btn-secondary mt-4 text-center">
                  Xem trước
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
