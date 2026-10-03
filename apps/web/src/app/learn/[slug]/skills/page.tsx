import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { isUserEnrolled } from "@feedbackme/core-lms";
import { getLanguageProfile } from "@feedbackme/core-feedback";
import { auth } from "@/lib/auth";
import LanguageProfileView from "@/components/LanguageProfileView";

export const dynamic = "force-dynamic";

/**
 * LANG G3 — Hồ sơ 4 kỹ năng (nghe, nói, đọc, viết) của chính học viên đang đăng nhập.
 *
 * Không nhận `userId` từ URL: trang này chỉ xem của mình. Giảng viên xem hồ sơ học
 * viên qua API /api/courses/:id/language-profile?userId= (màn riêng để sau).
 */
export default async function LanguageSkillsPage({ params }: { params: { slug: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect(`/signin?callbackUrl=/learn/${params.slug}/skills`);
  const userId = session.user.id;

  const course = await prisma.course.findUnique({
    where: { slug: params.slug },
    select: { id: true, title: true },
  });
  if (!course) notFound();
  if (!(await isUserEnrolled(userId, course.id))) redirect(`/catalog/${params.slug}?locked=1`);

  const profile = await getLanguageProfile(userId, course.id, "learner");

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 lg:px-6">
      <Link href={`/learn/${params.slug}`} className="link inline-flex items-center gap-1 text-sm">
        ← {course.title}
      </Link>
      <h1 className="text-h1 mt-3">Hồ sơ kỹ năng</h1>
      <p className="text-meta mt-1">
        Tổng hợp từ kết quả làm bài của bạn. Chỉ là gợi ý — bạn vẫn có thể học bất kỳ bài nào.
      </p>
      <div className="mt-6">
        <LanguageProfileView slug={params.slug} profile={profile} />
      </div>
    </main>
  );
}
