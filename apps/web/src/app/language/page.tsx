import Link from "next/link";
import type { Metadata } from "next";
import { getLanguageLearnerOverview, getLanguageTeacherOverview } from "@feedbackme/core-lms";
import { countPendingAiFeedback, getFlashcardStats, getLanguageProfile } from "@feedbackme/core-feedback";
import { auth } from "@/lib/auth";
import { getActiveRole } from "@/lib/active-role";
import { languageShellRole } from "@/lib/languageMenu";
import { languageLabelText } from "@/lib/languageRadar";
import { LANGUAGE_SKILL_LABEL } from "@feedbackme/shared-types";
import { NOINDEX } from "@/lib/seo";
import EmptyState from "@/components/ui/EmptyState";
import PageFrame, { StatCard } from "@/components/language/PageFrame";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const session = await auth();
  // Khách thấy trang giới thiệu (index được); người đã đăng nhập thấy dữ liệu riêng ⇒ noindex.
  return session?.user?.id ? { title: "Tổng quan — Limio Language", ...NOINDEX } : { title: "Limio Language — Speak in Flow" };
}

export default async function LanguageHome() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return <GuestIntro />;
  const role = languageShellRole(getActiveRole(session.user.roles ?? []));
  return role === "teacher" ? <TeacherHome userId={userId} /> : <LearnerHome userId={userId} />;
}

function GuestIntro() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-center">
      <h1 className="text-display">
        Limio <span className="text-emerald-600">Language</span>
      </h1>
      <p className="font-[family-name:var(--font-script)] mt-2 text-xl italic text-lime-700">Speak in Flow</p>
      <p className="text-body mx-auto mt-6 max-w-xl">
        Học và dạy ngoại ngữ trên Limio: bài nghe, từ vựng và hội thoại có âm thanh, luyện đề và thi thử bấm giờ theo từng kỹ
        năng, góp ý bài viết và bài nói bằng AI có giảng viên duyệt.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/signin?callbackUrl=/language" className="btn-primary">
          Đăng nhập
        </Link>
        <Link href="/catalog" className="btn-ghost">
          Xem các khoá học
        </Link>
      </div>
    </main>
  );
}

const SKILL_CHIP: Record<string, string> = {
  needs_review: "bg-amber-100 text-amber-800",
  practice_more: "bg-sky-100 text-sky-800",
  solid: "bg-emerald-100 text-emerald-800",
  no_data: "bg-[rgb(var(--surface-muted))] text-muted",
};

async function TeacherHome({ userId }: { userId: string }) {
  const o = await getLanguageTeacherOverview(userId);
  const ai = await countPendingAiFeedback(o.courses.map((c) => c.id));
  return (
    <PageFrame
      title="Tổng quan"
      description="Khoá ngoại ngữ của bạn, bài chờ chấm và góp ý AI chờ duyệt."
      actions={
        <>
          <Link href="/instructor/courses/new" className="btn-primary btn-sm">
            Tạo khoá / khoá mẫu
          </Link>
          <Link href="/language/exams" className="btn-secondary btn-sm">
            Đề thi
          </Link>
        </>
      }
    >
      {o.courses.length === 0 ? (
        <EmptyState
          title="Chưa có khoá ngoại ngữ nào"
          description="Bắt đầu từ một khoá mẫu Tiếng Trung hoặc Tiếng Anh (dựng sẵn bốn kỹ năng, rubric và một đề thi thử), hoặc tạo khoá trống rồi bật chế độ ngoại ngữ."
          actions={[{ label: "Tạo khoá ngoại ngữ", href: "/instructor/courses/new", variant: "primary" }]}
        />
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Số liệu nhanh">
            <StatCard label="Khoá ngoại ngữ" value={o.courses.length} href="/language/courses" />
            <StatCard label="Đề thi" value={o.exams.published} hint={`${o.exams.draft} đang soạn`} href="/language/exams" />
            <StatCard label="Bài chờ chấm" value={o.pendingGradeTotal} hint="Viết và Nói" href="/language/review" tone={o.pendingGradeTotal > 0 ? "warn" : "default"} />
            <StatCard label="Góp ý AI chờ duyệt" value={ai.total} hint={`${ai.writing} Viết · ${ai.speaking} Nói`} href="/language/review" tone={ai.total > 0 ? "warn" : "default"} />
          </section>

          <section aria-labelledby="my-courses">
            <h2 id="my-courses" className="text-h3">Khoá của tôi</h2>
            <ul className="mt-3 divide-y divide-[rgb(var(--border))] rounded-xl border border-token bg-[rgb(var(--surface))]">
              {o.courses.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <Link href={`/instructor/courses/${c.id}`} className="font-medium hover:underline">{c.title}</Link>
                    <div className="text-caption text-muted">
                      {c.status === "published" ? "Đã xuất bản" : "Nháp"} · {c.studentCount} học viên · {c.examCount} đề
                    </div>
                  </div>
                  {c.pendingGrade > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">{c.pendingGrade} bài chờ chấm</span>}
                </li>
              ))}
            </ul>
          </section>

          {o.pendingGrade.length > 0 && (
            <section aria-labelledby="pending">
              <h2 id="pending" className="text-h3">Bài chờ chấm lâu nhất</h2>
              <ul className="mt-3 divide-y divide-[rgb(var(--border))] rounded-xl border border-token bg-[rgb(var(--surface))]">
                {o.pendingGrade.map((p) => (
                  <li key={p.submissionId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <span className="min-w-0">
                      <b>{p.studentName}</b> · {p.assignmentTitle}
                      <span className="text-muted"> — {LANGUAGE_SKILL_LABEL[p.skill]}, {p.courseTitle}</span>
                    </span>
                    <Link href={`/instructor/assignments/${p.assignmentId}/submissions`} className="btn-ghost btn-sm">Chấm</Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </PageFrame>
  );
}

async function LearnerHome({ userId }: { userId: string }) {
  const o = await getLanguageLearnerOverview(userId);
  if (o.courses.length === 0) {
    return (
      <PageFrame title="Tổng quan" description="Học ngoại ngữ trên Limio.">
        <EmptyState
          title="Bạn chưa học khoá ngoại ngữ nào"
          description="Tìm một khoá trong catalog, hoặc dùng đường dẫn mời của giảng viên."
          actions={[{ label: "Xem catalog khoá học", href: "/catalog", variant: "primary" }]}
        />
      </PageFrame>
    );
  }
  const head = o.courses.slice(0, 6);
  const stats = await Promise.all(head.map((c) => getFlashcardStats(userId, c.id).catch(() => null)));
  const dueToday = stats.reduce((a, s) => a + (s?.dueToday ?? 0), 0);
  const profile = await getLanguageProfile(userId, head[0]!.id, "learner").catch(() => null);
  return (
    <PageFrame title="Tổng quan" description="Tiếp tục học, ôn thẻ từ và luyện thi.">
      {o.continue && (
        <Link
          href={`/learn/${o.continue.courseSlug}/lessons/${o.continue.lessonId}`}
          className="flex items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-brand-600 to-emerald-500 px-5 py-4 text-white shadow-sm"
        >
          <span>
            <span className="block text-sm font-semibold">Tiếp tục học</span>
            <span className="block text-sm text-white/85">{o.continue.courseTitle}</span>
          </span>
          <span aria-hidden>→</span>
        </Link>
      )}
      <section className="grid gap-3 sm:grid-cols-3" aria-label="Việc hôm nay">
        <StatCard label="Thẻ cần ôn hôm nay" value={dueToday} href="/language/cards" tone={dueToday > 0 ? "warn" : "default"} />
        <StatCard label="Đề đang mở" value={o.openExamTotal} hint="Luyện đề và thi thử" href="/language/practice" />
        <StatCard label="Khoá đang học" value={o.courses.length} href="/language/courses" />
      </section>
      {profile?.enabled && profile.skills.length > 0 && (
        <section aria-labelledby="skills">
          <h2 id="skills" className="text-h3">Kỹ năng của bạn</h2>
          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {profile.skills.map((s) => (
              <li key={s.skill} className="rounded-xl border border-token bg-[rgb(var(--surface))] p-3 text-sm">
                <div className="font-medium">{LANGUAGE_SKILL_LABEL[s.skill]}</div>
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${SKILL_CHIP[s.label]}`}>{languageLabelText(s.label)}</span>
              </li>
            ))}
          </ul>
          <Link href="/me/skills" className="link mt-2 inline-block text-sm">Xem hồ sơ kỹ năng →</Link>
        </section>
      )}
    </PageFrame>
  );
}
