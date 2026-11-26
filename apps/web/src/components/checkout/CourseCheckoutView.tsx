import Link from "next/link";
import AccessExpiryNote from "@/components/AccessExpiryNote";
import BookCover from "@/components/BookCover";
import EnrollButton, { type AccessPlanOption, type PaymentProviderChoice } from "@/components/EnrollButton";

export interface CourseCheckoutData {
  id: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  priceCents: number | null;
  originalPriceCents: number | null;
  currency: string;
  moduleCount: number;
  lessonCount: number;
}

/** Giao diện trang thanh toán khoá (docs/tieu-chi/trang-thanh-toan.md, AC1). Thuần trình bày: dữ liệu và quyền do page nạp. */
export default function CourseCheckoutView({
  course,
  accessPlans,
  paymentProviders,
  paymentEnabled,
  transferInstructions,
  summaryNote,
  currentExpiry = null,
}: {
  course: CourseCheckoutData;
  accessPlans: AccessPlanOption[];
  paymentProviders: PaymentProviderChoice[];
  paymentEnabled: boolean;
  transferInstructions: string | null;
  /** Câu mô tả đã dịch: "N module · M bài". */
  summaryNote: string;
  /** Đang gia hạn: hạn hiện tại của người mua (thời hạn mua thêm sẽ cộng dồn vào đó). */
  currentExpiry?: Date | null;
}) {
  const noGateway = paymentProviders.length === 0;
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 pb-16 lg:px-6">
      <Link href={`/catalog/${course.slug}`} className="link text-sm">
        ← {course.title}
      </Link>
      <h1 className="h-display mt-4 text-2xl font-bold sm:text-3xl">Thanh toán</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_minmax(0,26rem)] lg:items-start">
        <section className="card" aria-label="Tóm tắt đơn">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">Bạn đang mua</h2>
          <div className="mt-4 flex gap-4">
            {course.coverUrl && <BookCover src={course.coverUrl} alt="" className="w-28 shrink-0 sm:w-36" />}
            <div className="min-w-0">
              <h3 className="text-lg font-bold leading-snug">{course.title}</h3>
              <p className="mt-1 text-sm text-muted">{summaryNote}</p>
              {currentExpiry && (
                <div className="mt-3 rounded-lg bg-brand-soft p-3 text-sm">
                  <p className="font-semibold">Bạn đang gia hạn khoá này</p>
                  <AccessExpiryNote expiresAt={currentExpiry} />
                  <p className="mt-1 text-xs text-muted">Thời hạn của gói bạn mua sẽ được cộng thêm vào hạn hiện tại.</p>
                </div>
              )}
              <p className="mt-3 text-sm text-muted">
                {accessPlans.length > 1
                  ? "Chọn gói truy cập ở khung bên cạnh. Thời hạn tính từ lúc thanh toán thành công."
                  : "Thời hạn truy cập tính từ lúc thanh toán thành công."}
              </p>
            </div>
          </div>
        </section>

        <section className="card lg:sticky lg:top-6" aria-label="Thanh toán">
          <EnrollButton
            courseId={course.id}
            slug={course.slug}
            alreadyEnrolled={false}
            priceCents={course.priceCents}
            originalPriceCents={course.originalPriceCents}
            currency={course.currency}
            paymentEnabled={paymentEnabled}
            accessPlans={accessPlans}
            paymentProviders={paymentProviders}
            noGateway={noGateway}
            transferInstructions={transferInstructions}
            checkoutMode
          />
        </section>
      </div>
    </main>
  );
}
