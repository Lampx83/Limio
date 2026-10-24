import Link from "next/link";
import { redirect } from "next/navigation";
import { CoursePackError, listPublishedPacks } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { getInstructorCenterAccess } from "@/lib/centerAccess";

export const dynamic = "force-dynamic";

const LANGUAGE_LABEL: Record<string, string> = { zh: "Tiếng Trung", en: "Tiếng Anh", ko: "Tiếng Hàn", ja: "Tiếng Nhật", vi: "Tiếng Việt" };

export default async function PackLibraryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/instructor/giao-trinh");

  // Tính năng trung tâm chưa bật cho tài khoản này: không có trang để xem.
  if (!(await getInstructorCenterAccess(session.user.id))) redirect("/instructor/dashboard");

  let packs;
  try {
    packs = await listPublishedPacks(session.user.id);
  } catch (e) {
    if (e instanceof CoursePackError && e.code === "forbidden") redirect("/instructor/dashboard");
    throw e;
  }

  return (
    <main>
      <h1 className="text-h1">Giáo trình dựng sẵn</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Giáo án từng buổi đã soạn sẵn: bài từ vựng, hội thoại, quiz và bài tập về nhà. Thầy/cô chọn một giáo trình, Limio sao về
        thành khoá của thầy/cô để chỉnh theo lớp mình; bản gốc không bị ảnh hưởng.
      </p>

      {packs.length === 0 ? (
        <div className="mt-6 rounded border border-dashed border-default p-6 text-center text-sm text-faint">
          Chưa có giáo trình nào trong thư viện.
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packs.map((p) => (
            <li key={p.id} className="card flex flex-col p-5">
              <p className="text-meta">
                {LANGUAGE_LABEL[p.language] ?? p.language}
                {p.outcomeLevel ? ` · đầu ra ${p.outcomeLevel}` : ""}
              </p>
              <h2 className="mt-1 text-h4">{p.title}</h2>
              <p className="mt-2 flex-1 text-sm text-muted">{p.summary}</p>
              <p className="mt-3 text-sm">
                {p.sessionCount} buổi · {p.lessonCount} bài
              </p>
              <Link href={`/instructor/giao-trinh/${p.id}`} className="btn-primary mt-4 text-center">
                Xem trước
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
