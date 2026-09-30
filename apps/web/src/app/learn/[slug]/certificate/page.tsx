import BadgeIcon from "@/components/ui/BadgeIcon";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Roboto } from "next/font/google";
import { LimioLearningLogo } from "@/components/BrandIcons";
import { prisma } from "@feedbackme/db";
import { getCourseProgress, isUserEnrolled, issueCertificate } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { formatVN } from "@/lib/datetime";

export const dynamic = "force-dynamic";

// Cùng font với bản PDF (xem apps/web/src/lib/certificatePdf.tsx) — chỉ áp
// riêng cho khối chứng nhận, không đổi font toàn trang (page vẫn Inter).
const roboto = Roboto({ subsets: ["latin", "vietnamese"], weight: ["400", "700"] });

export default async function CertificatePage({
  params,
}: {
  params: { slug: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=/learn/${params.slug}/certificate`);
  }
  const userId = session.user.id;

  const course = await prisma.course.findUnique({
    where: { slug: params.slug },
    select: { id: true, title: true, description: true, language: true },
  });
  if (!course) notFound();
  if (!(await isUserEnrolled(userId, course.id))) {
    redirect(`/catalog/${params.slug}`);
  }

  const progress = await getCourseProgress(userId, course.id);
  if (progress.courseCompletionPct < 100) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
        <Link
          href={`/learn/${params.slug}`}
          className="link inline-flex items-center gap-1 text-sm"
        >
          ← {course.title}
        </Link>
        <div className="mt-6 rounded-2xl border border-accent-200 bg-accent-50 p-6">
          <p className="text-sm font-semibold text-accent-700">
            Bạn chưa hoàn thành khóa này ({progress.courseCompletionPct}%)
          </p>
          <p className="mt-2 text-sm text-accent-700/90">
            Hãy hoàn thành tất cả bài học để nhận chứng nhận.
          </p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/60">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-brand-500 to-brand-700 transition-all"
              style={{ width: `${progress.courseCompletionPct}%` }}
            />
          </div>
        </div>
      </main>
    );
  }

  // A6 — idempotent: tạo ở lần xem đầu tiên, những lần sau chỉ đọc lại đúng
  // bản đã cấp (tên/tên khoá snapshot lúc đó, không đổi theo dữ liệu hiện tại).
  const certificate = await issueCertificate(userId, course.id);

  const skillBadges = await prisma.userBadge.findMany({
    where: {
      userId,
      badge: { category: "skill" },
      context: { path: ["courseId"], equals: course.id },
    },
    include: { badge: { select: { code: true, name: true } } },
  });

  const verifyUrl = `${(process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "")}/verify/${certificate.certNumber}`;
  const issuedAtLabel = formatVN(certificate.issuedAt, { year: "numeric", month: "long", day: "numeric" });

  // LinkedIn "Add to Profile" — mở sẵn form Licenses & Certifications điền
  // trước tên/khoá/ngày cấp + link xác thực. Không cần OAuth hay LinkedIn
  // Company Page ID, chỉ cần đúng query params theo chuẩn của LinkedIn.
  const linkedinParams = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: course.title,
    organizationName: certificate.issuerName,
    issueYear: String(certificate.issuedAt.getFullYear()),
    issueMonth: String(certificate.issuedAt.getMonth() + 1),
    certUrl: verifyUrl,
    certId: certificate.certNumber,
  });
  const linkedinUrl = `https://www.linkedin.com/profile/add?${linkedinParams.toString()}`;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6 print:">
      <Link
        href={`/learn/${params.slug}`}
        className="link inline-flex items-center gap-1 text-sm print:hidden"
      >
        ← {course.title}
      </Link>

      <article
        className={`${roboto.className} relative mx-auto mt-6 flex aspect-[841.89/595.28] w-full max-w-5xl flex-col bg-gradient-to-br from-brand-50 via-white to-pink-50 text-center shadow-card-hover print:aspect-auto print:shadow-none`}
      >
        {/* Lớp trang trí nằm trong hộp riêng có overflow-hidden: <article> KHÔNG được
            overflow-hidden, vì aspect-ratio chỉ là mức tối thiểu khi overflow còn visible —
            cắt ở đây thì khung cứng theo tỉ lệ A4 và nội dung dài (mô tả, chữ ký, mã
            chứng nhận) bị xén mất phần dưới khi cửa sổ hẹp. */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {/* Decorative corner glows — lime góc trên-trái, hồng góc dưới-phải, cùng 2 tông màu với 2 tam giác góc trên bản PDF (CORNER_LIME/CORNER_PINK) */}
          <div className="absolute -left-20 -top-20 h-48 w-48 rounded-full bg-brand-200/40 blur-3xl" aria-hidden />
          <div className="absolute -bottom-20 -right-20 h-48 w-48 rounded-full bg-pink-200/40 blur-3xl" aria-hidden />
          {/* Hoạ tiết nền — lát chanh trừu tượng (vành + 6 nan cong, thay 4 nan thẳng của logo thật) lệch hàng kiểu gạch xây; cùng motif với apps/web/src/lib/certificatePdf.tsx LimeSliceAbstractMotif */}
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'%3E%3Cdefs%3E%3Cg id='m' fill='none' stroke='%233f6212' stroke-width='0.9' stroke-linecap='round'%3E%3Ccircle cx='0' cy='0' r='13' stroke-width='1'/%3E%3Cpath d='M0 0 Q5.93 2.89 12 0'/%3E%3Cpath d='M0 0 Q0.46 6.58 6 10.39'/%3E%3Cpath d='M0 0 Q-5.47 3.69 -6 10.39'/%3E%3Cpath d='M0 0 Q-5.93 -2.89 -12 0'/%3E%3Cpath d='M0 0 Q-0.46 -6.58 -6 -10.39'/%3E%3Cpath d='M0 0 Q5.47 -3.69 6 -10.39'/%3E%3C/g%3E%3C/defs%3E%3Cuse href='%23m' x='24' y='24'/%3E%3Cuse href='%23m' x='72' y='24'/%3E%3Cuse href='%23m' x='0' y='72'/%3E%3Cuse href='%23m' x='48' y='72'/%3E%3Cuse href='%23m' x='96' y='72'/%3E%3C/svg%3E\")",
              backgroundSize: "96px 96px",
            }}
            aria-hidden
          />
        </div>

        {/* Khung đôi (outer 1.5px + inner 1px, cách nhau 1 khoảng hở), góc
            vuông sắc — đúng như outerFrame/innerFrame lồng nhau của bản PDF
            (react-pdf không bo góc 2 khung này), thay vì CSS border-double
            (chỉ là 1 viền mảnh, không có khoảng hở thật) hay góc bo tròn. */}
        <div className="relative m-2 flex flex-1 border-[1.5px] border-brand-800 p-1 sm:m-3">
          <div className="relative flex h-full w-full flex-col items-center justify-center border border-brand-800 p-4 sm:p-8">
            {/* Bố cục học theo apps/web/src/lib/certificatePdf.tsx: một khối
                căn giữa theo chiều dọc (logo → kicker → tên khoá → hoàn
                thành bởi → mô tả/badge tuỳ chọn → hàng chữ ký/mã chứng nhận
                dưới đáy), thay vì stack dọc dài như bản cũ.
                Header chỉ gồm 2 logo (Limio + Organization) khi có logo —
                KHÔNG kèm tên chữ ở đây; tên trường đã hiện đủ ở ô chữ ký
                cuối trang ("Cấp bởi Limio × <tên trường>"). */}
            {certificate.issuerLogoUrl ? (
              <div className="mb-3 flex items-center justify-center gap-3.5">
                <LimioLearningLogo className="h-7 w-auto shrink-0" />
                <div className="h-7 w-px bg-gray-300" aria-hidden />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={certificate.issuerLogoUrl}
                  alt=""
                  className="h-8 w-8 shrink-0 object-contain sm:h-9 sm:w-9"
                />
              </div>
            ) : (
              <LimioLearningLogo className="mb-3 h-7 w-auto" />
            )}

            <p className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-[0.6875rem] font-bold uppercase tracking-[0.3em] text-brand-800 backdrop-blur sm:text-xs">
              Chứng nhận hoàn thành
            </p>

            <p className="mt-4 text-2xl font-bold leading-tight tracking-tight sm:text-4xl">
              {course.title}
            </p>
            <p className="mt-3 text-lg font-bold sm:text-xl">{certificate.userNameSnapshot}</p>
            <p className="mt-1 text-xs text-faint">{issuedAtLabel}</p>

            {course.description && (
              <p className="mx-auto mt-3 hidden max-w-xl text-xs italic text-faint sm:block">
                {course.description.length > 140
                  ? course.description.slice(0, 140) + "…"
                  : course.description}
              </p>
            )}

            {skillBadges.length > 0 && (
              <ul className="mt-3 flex flex-wrap justify-center gap-1.5">
                {skillBadges.slice(0, 4).map((sb) => (
                  <li
                    key={sb.id}
                    className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-[0.6875rem] font-semibold text-brand-800"
                  >
                    <BadgeIcon code={sb.badge.code} className="h-5 w-5" />
                    {sb.badge.name}
                  </li>
                ))}
              </ul>
            )}

            {/* 2 chữ ký cạnh nhau (Limio trái, Organization phải) khi khoá
                thuộc 1 Organization — mỗi bên độc lập: ảnh + dòng kẻ + tên/
                chức danh riêng. Chỉ Limio thì 1 khối đứng một mình. */}
            {certificate.issuerOrgName ? (
              <div className="mt-6 flex w-full items-start justify-between gap-4">
                <div className="flex flex-col items-start text-left">
                  {certificate.platformSignatureUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={certificate.platformSignatureUrl}
                      alt=""
                      className="mb-1 h-6 max-w-[5rem] object-contain"
                    />
                  )}
                  <div className="h-px w-20 bg-gray-300" />
                  <p className="mt-1.5 text-sm font-bold">
                    {certificate.platformSignatureName || "Limio Learning"}
                  </p>
                  <p className="text-[0.6875rem] text-faint">
                    {certificate.platformSignatureTitle || "Nền tảng học tập cá nhân hoá"}
                  </p>
                </div>
                <div className="flex flex-col items-start text-left">
                  {certificate.issuerSignatureUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={certificate.issuerSignatureUrl}
                      alt=""
                      className="mb-1 h-6 max-w-[5rem] object-contain"
                    />
                  )}
                  <div className="h-px w-20 bg-gray-300" />
                  <div className="mt-1.5 flex items-center gap-1.5">
                    {certificate.issuerLogoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={certificate.issuerLogoUrl}
                        alt=""
                        className="h-4 w-4 object-contain"
                      />
                    )}
                    <p className="text-sm font-bold">
                      {certificate.issuerSignatureName || certificate.issuerOrgName}
                    </p>
                  </div>
                  {certificate.issuerSignatureTitle && (
                    <p className="text-[0.6875rem] text-faint">{certificate.issuerSignatureTitle}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-6 flex w-full flex-col items-start text-left">
                {certificate.platformSignatureUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={certificate.platformSignatureUrl}
                    alt=""
                    className="mb-1 h-6 max-w-[5rem] object-contain"
                  />
                )}
                <div className="h-px w-20 bg-gray-300" />
                <p className="mt-1.5 text-sm font-bold">
                  {certificate.platformSignatureName || certificate.issuerName}
                </p>
                <p className="text-[0.6875rem] text-faint">
                  {certificate.platformSignatureTitle || "Nền tảng học tập cá nhân hoá"}
                </p>
              </div>
            )}

            <p className="mt-4 w-full border-t border-token pt-3 text-center text-xs text-faint">
              Mã chứng nhận: <span className="font-mono">{certificate.certNumber}</span>
            </p>
          </div>
        </div>
      </article>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3 print:hidden">
        <a href={`/api/certificates/${params.slug}/pdf`} className="btn-primary">
          Tải PDF
        </a>
        <a
          href={linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary"
        >
          Thêm vào LinkedIn
        </a>
        <Link href={`/verify/${certificate.certNumber}`} className="link text-sm">
          Xem trang xác thực công khai →
        </Link>
      </div>
    </main>
  );
}
