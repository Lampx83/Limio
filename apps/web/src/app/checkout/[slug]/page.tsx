import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import type { AccessPlanOption } from "@/components/EnrollButton";
import CourseCheckoutView from "@/components/checkout/CourseCheckoutView";
import { getPaymentEnabled, getSiteSetting } from "@/lib/site-settings";
import { getConfiguredPaymentProviders } from "@/lib/paymentProviders";
import { courseCheckoutGate } from "@/lib/checkoutGate";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
// Trang giao dịch của từng người: không đưa lên tìm kiếm.
export const metadata: Metadata = { title: "Thanh toán | Limio", robots: { index: false, follow: false, nocache: true } };

/** Trang thanh toán khoá (docs/tieu-chi/trang-thanh-toan.md, AC1). Việc tạo đơn và cấp quyền vẫn ở /api/orders/checkout + IPN. */
export default async function CheckoutPage({ params }: { params: { slug: string } }) {
  const t = await getT();
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const course = await prisma.course.findUnique({
    where: { slug: params.slug },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      enrollMode: true,
      coverUrl: true,
      priceCents: true,
      originalPriceCents: true,
      currency: true,
      modules: { select: { _count: { select: { lessons: true } } } },
    },
  });

  const paymentEnabled = await getPaymentEnabled();
  const [accessPlans, paymentProviders, enrollment] = await Promise.all([
    course && paymentEnabled
      ? prisma.courseAccessPlan.findMany({
          where: { courseId: course.id, isActive: true },
          orderBy: { priceCents: "asc" },
          select: { id: true, label: true, durationMonths: true, priceCents: true, currency: true },
        })
      : Promise.resolve([] as AccessPlanOption[]),
    paymentEnabled ? getConfiguredPaymentProviders().catch(() => []) : Promise.resolve([]),
    course && userId
      ? prisma.enrollment.findUnique({
          where: { userId_courseId: { userId, courseId: course.id } },
          select: { status: true, accessExpiresAt: true },
        })
      : Promise.resolve(null),
  ]);
  const now = new Date();
  const enrolled =
    !!enrollment && (enrollment.status === "active" || enrollment.status === "completed") && (enrollment.accessExpiresAt === null || enrollment.accessExpiresAt > now);
  const accessLimited = enrolled && enrollment!.accessExpiresAt !== null;

  const gate = courseCheckoutGate({
    slug: params.slug,
    userId,
    course,
    paymentEnabled,
    planCount: accessPlans.length,
    enrolled,
    accessLimited,
  });
  if (gate.kind === "notFound" || !course) notFound();
  if (gate.kind === "redirect") redirect(gate.to);

  const transferInstructions = paymentProviders.length === 0 ? await getSiteSetting("payment.transfer_instructions") : null;
  const lessonCount = course.modules.reduce((n, m) => n + m._count.lessons, 0);

  return (
    <CourseCheckoutView
      course={{
        id: course.id,
        slug: course.slug,
        title: course.title,
        coverUrl: course.coverUrl,
        priceCents: course.priceCents,
        originalPriceCents: course.originalPriceCents,
        currency: course.currency,
        moduleCount: course.modules.length,
        lessonCount,
      }}
      accessPlans={accessPlans}
      paymentProviders={paymentProviders}
      paymentEnabled={paymentEnabled}
      transferInstructions={transferInstructions}
      currentExpiry={accessLimited ? enrollment!.accessExpiresAt : null}
      summaryNote={t("catalog.detail.moduleLessonCount", { modules: course.modules.length, lessons: lessonCount })}
    />
  );
}
