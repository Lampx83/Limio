import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CoursePackError, getPackPreview, type PackLessonKinds } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import UsePackButton from "./UsePackButton";

export const dynamic = "force-dynamic";

function kindsText(k: PackLessonKinds): string {
  const parts: string[] = [];
  if (k.vocab) parts.push("từ vựng");
  if (k.dialogue) parts.push("hội thoại");
  if (k.audio) parts.push("audio");
  if (k.quiz) parts.push(`${k.quiz} quiz`);
  if (k.assignment) parts.push("bài tập về nhà");
  if (k.teacherNote) parts.push("ghi chú cho giáo viên");
  return parts.join(" · ");
}

export default async function PackPreviewPage({ params }: { params: { packId: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect(`/signin?callbackUrl=/instructor/giao-trinh/${params.packId}`);

  let pack;
  try {
    pack = await getPackPreview(session.user.id, params.packId);
  } catch (e) {
    if (e instanceof CoursePackError) {
      if (e.code === "pack_not_found" || e.code === "not_published") notFound();
      if (e.code === "forbidden") redirect("/instructor/dashboard");
    }
    throw e;
  }

  return (
    <main>
      <Link href="/instructor/giao-trinh" className="text-sm font-medium text-lime-700 hover:underline dark:text-lime-400">
        ← Giáo trình dựng sẵn
      </Link>
      <h1 className="mt-3 text-h1">{pack.title}</h1>
      <p className="mt-1 text-sm text-muted">
        {pack.sessionCount} buổi · {pack.lessonCount} bài{pack.outcomeLevel ? ` · đầu ra ${pack.outcomeLevel}` : ""} · bản {pack.version}
      </p>
      <p className="mt-3 max-w-2xl text-sm">{pack.summary}</p>

      <div className="mt-5">
        <UsePackButton packId={pack.id} />
      </div>

      <h2 className="mt-8 text-h3">Các buổi học</h2>
      <ol className="mt-3 space-y-2">
        {pack.sessions.map((s) => (
          <li key={s.sessionNo}>
            <details className="rounded-2xl border border-token bg-[rgb(var(--surface))] px-4 py-3">
              <summary className="cursor-pointer font-medium">
                Buổi {s.sessionNo}: {s.title.replace(/^Buổi\s*\d+\s*[:.\-–]\s*/i, "")}
              </summary>
              <ul className="mt-3 space-y-2 text-sm">
                {s.lessons.map((l) => (
                  <li key={l.id}>
                    <span className="font-medium">{l.title}</span>
                    {kindsText(l.kinds) && <span className="block text-muted">{kindsText(l.kinds)}</span>}
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ol>
    </main>
  );
}
