import type { Metadata } from "next";
import Link from "next/link";
import { listSampleCourses, type SampleCourse } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import { isFree, formatPrice } from "@/lib/formatPrice";
import { htmlToPlainText } from "@/lib/richText";
import { getPaymentEnabled } from "@/lib/site-settings";
import { EmptyState } from "@/components/ui";
import JsonLd from "@/components/JsonLd";
import { absoluteUrl, breadcrumbJsonLd, pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Học thử với khoá mẫu",
  description:
    "Các khoá học mẫu trên Limio: xem bài giảng, thử cách học và nhận phản hồi cá nhân hoá " +
    "trước khi chọn khoá phù hợp với bạn. Có khoá miễn phí và khoá trả phí.",
  path: "/learning",
});

const LEVEL_LABEL: Record<string, string> = {
  beginner: "Cơ bản",
  intermediate: "Trung cấp",
  advanced: "Nâng cao",
};

export default async function LearningPage() {
  const session = await auth();
  const [courses, paymentEnabled] = await Promise.all([listSampleCourses(), getPaymentEnabled()]);

  const enrolledCourseIds =
    session?.user?.id && courses.length > 0
      ? new Set(
          (
            await prisma.enrollment.findMany({
              where: {
                userId: session.user.id,
                courseId: { in: courses.map((c) => c.id) },
                status: { notIn: ["dropped", "refunded"] },
              },
              select: { courseId: true },
            })
          ).map((e) => e.courseId),
        )
      : new Set<string>();

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6 pb-24 lg:pb-12">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Trang chủ", path: "/" },
            { name: "Học thử", path: "/learning" },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "Khoá học mẫu trên Limio",
            numberOfItems: courses.length,
            itemListElement: courses.map((c, i) => ({
              "@type": "ListItem",
              position: i + 1,
              url: absoluteUrl(`/catalog/${c.slug}`),
              name: c.title,
            })),
          },
        ]}
      />

      <span className="chip-brand">Học thử</span>
      <h1 className="mt-3 h-display text-h1">Học thử với khoá mẫu</h1>
      <p className="mt-2 max-w-2xl text-meta">
        Chọn một khoá mẫu để trải nghiệm cách học trên Limio. Khoá miễn phí học được ngay; khoá
        trả phí cần mua để vào học.
      </p>

      {courses.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            icon="📚"
            title="Khoá mẫu đang được cập nhật"
            description="Hiện chưa có khoá mẫu nào. Bạn có thể xem tất cả khoá học đang mở."
            actions={[{ label: "Khám phá khoá học", href: "/catalog" }]}
          />
        </div>
      ) : (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c, idx) => (
            <SampleCourseCard
              key={c.id}
              course={c}
              idx={idx}
              paymentEnabled={paymentEnabled}
              enrolled={enrolledCourseIds.has(c.id)}
            />
          ))}
        </ul>
      )}
    </main>
  );
}

function SampleCourseCard({
  course: c,
  idx,
  paymentEnabled,
  enrolled,
}: {
  course: SampleCourse;
  idx: number;
  paymentEnabled: boolean;
  enrolled: boolean;
}) {
  // Khi tắt thanh toán, catalog coi mọi khoá là miễn phí — card này phải nhất quán.
  const paid =
    paymentEnabled && (!!c.cheapestAccessPlan || !isFree(c.priceCents));

  // Học viên đã ghi danh vào thẳng khoá; khoá miễn phí mở cho khách vào thẳng bài
  // đầu; còn lại (kể cả mọi khoá bán) đi qua trang giới thiệu để đăng ký/mua.
  const href = enrolled
    ? `/learn/${c.slug}`
    : c.firstLessonId && !paid
      ? `/learn/${c.slug}/lessons/${c.firstLessonId}`
      : `/catalog/${c.slug}`;
  const cta = enrolled
    ? "Tiếp tục học →"
    : c.firstLessonId && !paid
      ? "Học ngay →"
      : paid
        ? "Xem & mua →"
        : "Xem chi tiết →";

  return (
    <li className="animate-fade-in-up" style={{ animationDelay: `${Math.min(idx * 40, 280)}ms` }}>
      <Link href={href} className="card-hover group block h-full" prefetch={false}>
        <div className="relative -m-5 mb-4 h-24 overflow-hidden rounded-t-xl bg-brand-gradient">
          <div
            className="absolute inset-0 bg-hero-grid opacity-30"
            style={{ backgroundSize: "16px 16px" }}
            aria-hidden
          />
          <div className="absolute bottom-3 left-4 right-4 flex flex-wrap gap-1.5">
            {c.level && (
              <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-bold text-brand-700 shadow">
                {LEVEL_LABEL[c.level] ?? c.level}
              </span>
            )}
            {c.category && (
              <span className="rounded-md bg-white/30 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm backdrop-blur">
                {c.category}
              </span>
            )}
          </div>
        </div>

        <h2 className="text-base font-semibold leading-snug transition-colors group-hover:text-brand-600">
          {c.title}
        </h2>
        <p className="mt-2 line-clamp-3 text-sm text-muted">{htmlToPlainText(c.description)}</p>

        <div className="mt-3 flex items-center justify-between border-t border-token pt-3 text-xs">
          {enrolled ? (
            <span className="font-semibold text-success-600">✓ Đã ghi danh</span>
          ) : paid && c.cheapestAccessPlan ? (
            <span className="font-semibold text-accent-600">
              Từ {formatPrice(c.cheapestAccessPlan.priceCents, c.cheapestAccessPlan.currency)}
            </span>
          ) : paid ? (
            <span className="font-semibold text-accent-600">
              {formatPrice(c.priceCents!, c.currency)}
            </span>
          ) : (
            <span className="font-semibold text-success-600">Miễn phí</span>
          )}
          <span className="ml-auto font-semibold text-brand-600 group-hover:text-brand-700">
            {cta}
          </span>
        </div>
      </Link>
    </li>
  );
}
