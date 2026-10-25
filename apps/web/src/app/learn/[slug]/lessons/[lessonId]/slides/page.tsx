import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { canEditCourse, getLiveDeckByLesson, getOrganizationSlideBrandForUser } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { resolveEffectiveBrand } from "@/lib/limioLiveBrand";
import { toPublicSlides } from "@/lib/limioLiveShare";
import SharedDeckView from "@/app/bai-giang/[code]/SharedDeckView";

/**
 * Slide của bài học như học viên sẽ xem (docs/tieu-chi/nghe-giang-slide.md, AC1, AC6). Slide đi qua `toPublicSlides` nên không
 * lộ ghi chú giảng hay đáp án; không lộ danh sách bài giảng khác của giảng viên.
 */
export const dynamic = "force-dynamic";

type Props = { params: { slug: string; lessonId: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lesson = await prisma.lesson.findUnique({ where: { id: params.lessonId }, select: { title: true } });
  return { title: lesson ? `Slide · ${lesson.title}` : "Slide bài học", robots: { index: false, follow: false } };
}

export default async function LessonSlidesPage({ params }: Props) {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const lesson = await prisma.lesson.findUnique({
    where: { id: params.lessonId },
    select: { title: true, module: { select: { course: { select: { id: true, slug: true } } } } },
  });
  if (!lesson || lesson.module.course.slug !== params.slug) notFound();

  const back = `/learn/${params.slug}/lessons/${params.lessonId}`;
  // Học viên chỉ nghe giảng slide khi bài đã có giọng (giai đoạn 3–4); đến lúc đó trang này mở cho họ qua cùng luật xem bài.
  // Hiện chỉ người sửa được khoá mới vào (nút "Slide" ở đầu bài của chủ khoá và đồng giảng viên).
  if (!userId) redirect(`/signin?callbackUrl=${encodeURIComponent(`${back}/slides`)}`);
  if (!(await canEditCourse(userId, lesson.module.course.id))) notFound();

  const deck = await getLiveDeckByLesson(params.lessonId, prisma);
  if (!deck) notFound();

  const org = deck.brandOff ? null : await getOrganizationSlideBrandForUser(deck.userId, prisma);
  const brand = resolveEffectiveBrand({
    deckBrand: deck.brand,
    brandOff: deck.brandOff,
    orgBrand: org?.slideBrand,
    orgLogoUrl: org?.logoUrl,
    deckTemplate: deck.brandTemplate,
  }).brand;

  return (
    <>
      <div className="mx-auto w-full max-w-5xl px-4 pt-3 lg:px-6">
        <Link href={back} className="link inline-flex items-center gap-1 text-sm print:hidden">
          ← Quay lại bài học
        </Link>
      </div>
      <SharedDeckView
        deckId={deck.id}
        motif={deck.motif}
        language={deck.language}
        imageFrame={deck.imageFrame}
        title={deck.title}
        ownerName={deck.ownerName}
        theme={deck.theme}
        brand={brand}
        slides={toPublicSlides(deck.slides)}
        allowPdf={false}
      />
    </>
  );
}
