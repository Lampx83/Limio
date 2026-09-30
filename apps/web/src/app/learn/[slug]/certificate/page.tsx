import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Roboto } from "next/font/google";
import { LimioLearningLogo } from "@/components/BrandIcons";
import { prisma } from "@feedbackme/db";
import { getCourseProgress, isUserEnrolled, issueCertificate } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { formatVN } from "@/lib/datetime";
import CertificateCanvas from "./CertificateCanvas";
import CertificateSeal from "./CertificateSeal";
import { formatDuration, tracked } from "@/lib/certificateFormat";

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
    select: { id: true, title: true, language: true },
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

  const [skillBadges, engagement] = await Promise.all([
    prisma.userBadge.findMany({
      where: {
        userId,
        badge: { category: "skill" },
        context: { path: ["courseId"], equals: course.id },
      },
      include: { badge: { select: { name: true } } },
    }),
    // Cùng nguồn với route PDF: thời lượng học thật (activeSec cộng dồn).
    prisma.lessonEngagement.aggregate({
      where: { userId, courseId: course.id },
      _sum: { activeSec: true },
    }),
  ]);

  const verifyUrl = `${(process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "")}/verify/${certificate.certNumber}`;
  const issuedAtLabel = formatVN(certificate.issuedAt, { year: "numeric", month: "long", day: "numeric" });
  const durationLabel = formatDuration(engagement._sum.activeSec ?? 0, { hours: "giờ", minutes: "phút" });

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

      {/* Bản xem trước dựng lại đúng bố cục PDF (apps/web/src/lib/certificatePdf.tsx):
          cùng toạ độ A4 ngang, kích thước chữ tính bằng px = pt của PDF. Sửa bố cục
          bên đó thì sửa cả ở đây. */}
      <CertificateCanvas>
        <article
          className={`${roboto.className} relative h-full w-full overflow-hidden bg-white text-center`}
        >
          {/* Hai góc màu chéo phía sau khung trắng (CORNER_LIME / CORNER_PINK) */}
          <svg
            className="absolute left-0 top-0"
            width={841.89}
            height={595.28}
            viewBox="0 0 841.89 595.28"
            aria-hidden="true"
          >
            <polygon points={`0,0 ${841.89 * 0.42},0 0,${595.28 * 0.58}`} fill="#ecfccb" />
            <polygon
              points={`841.89,595.28 ${841.89 - 841.89 * 0.42},595.28 841.89,${595.28 - 595.28 * 0.58}`}
              fill="#fce7f3"
            />
          </svg>

          {/* Thẻ trắng lề 46 quanh trang; hoạ tiết lát chanh (cell 48, hàng lệch nửa ô) opacity 0.07 */}
          <div className="absolute inset-[46px] bg-white">
            <div
              className="absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'%3E%3Cdefs%3E%3Cg id='m' fill='none' stroke='%233f6212' stroke-width='0.9' stroke-linecap='round'%3E%3Ccircle cx='16' cy='16' r='13' stroke-width='1'/%3E%3Cpath d='M16 16 Q21.93 18.89 28 16'/%3E%3Cpath d='M16 16 Q16.46 22.58 22 26.39'/%3E%3Cpath d='M16 16 Q10.53 19.69 10 26.39'/%3E%3Cpath d='M16 16 Q10.07 13.11 4 16'/%3E%3Cpath d='M16 16 Q15.54 9.42 10 5.61'/%3E%3Cpath d='M16 16 Q21.47 12.31 22 5.61'/%3E%3C/g%3E%3C/defs%3E%3Cg transform='scale(1.5)'%3E%3Cuse href='%23m' x='0' y='0'/%3E%3Cuse href='%23m' x='32' y='0'/%3E%3Cuse href='%23m' x='-16' y='32'/%3E%3Cuse href='%23m' x='16' y='32'/%3E%3Cuse href='%23m' x='48' y='32'/%3E%3C/g%3E%3C/svg%3E\")",
                backgroundSize: "96px 96px",
              }}
              aria-hidden
            />

            {/* Khung đôi: ngoài 1.5px (padding 5) + trong 0.75px, góc vuông */}
            <div className="absolute inset-0 flex border-[1.5px] border-[#3f6212] p-[5px]">
              <div className="relative flex flex-1 flex-col items-center justify-center border-[0.75px] border-[#3f6212] px-16 py-[30px]">
                {certificate.issuerLogoUrl ? (
                  <div className="flex items-center gap-3.5">
                    <LimioLearningLogo className="h-10 w-auto shrink-0" />
                    <div className="h-7 w-px bg-[#d1d5db]" aria-hidden />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={certificate.issuerLogoUrl}
                      alt=""
                      className="h-9 w-9 shrink-0 object-contain"
                    />
                  </div>
                ) : (
                  <LimioLearningLogo className="h-10 w-auto" />
                )}

                <p
                  aria-label="Chứng nhận hoàn thành"
                  className="mt-[18px] whitespace-pre text-[22.5px] font-bold leading-normal text-[#3f6212]"
                >
                  {tracked("CHỨNG NHẬN HOÀN THÀNH")}
                </p>

                <p className="mt-5 max-w-[620px] text-[51px] font-bold leading-[1.15] text-[#1f2937]">
                  {certificate.courseTitleSnapshot}
                </p>
                <p className="mt-[22px] text-[26px] font-bold leading-normal text-[#1f2937]">
                  {certificate.userNameSnapshot}
                </p>
                <p className="mt-1 text-[15.75px] leading-normal text-[#9ca3af]">
                  {issuedAtLabel}
                  {durationLabel ? ` · ${durationLabel}` : ""}
                </p>

                {skillBadges.length > 0 && (
                  <>
                    <p className="mt-[26px] whitespace-pre text-[13.5px] font-bold leading-normal text-[#9ca3af]">
                      {tracked("KỸ NĂNG ĐÃ ĐẠT")}
                    </p>
                    <ul className="mt-2.5 flex max-w-[560px] flex-wrap justify-center gap-[7px]">
                      {skillBadges.map((sb) => (
                        <li
                          key={sb.id}
                          className="rounded-xl border-[0.75px] border-[#d9f99d] px-3 py-[5px] text-[14.25px] leading-normal text-[#3f6212]"
                        >
                          {sb.badge.name}
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {/* Hàng dưới: chữ ký bên trái, con dấu bên phải (bottomRow của PDF) */}
                <div className="mt-9 flex w-full items-end justify-between">
                  {certificate.issuerOrgName ? (
                    <div className="flex gap-7">
                      <div className="flex flex-col items-center">
                        {certificate.platformSignatureUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={certificate.platformSignatureUrl}
                            alt=""
                            className="mb-1 h-6 max-w-[84px] object-contain"
                          />
                        )}
                        <div className="mb-1.5 h-[0.75px] w-[110px] bg-[#a3a3a3]" />
                        <p className="text-sm font-bold leading-normal text-[#1f2937]">
                          {certificate.platformSignatureName || "Limio Learning"}
                        </p>
                        <p className="mt-0.5 text-[9.5px] leading-normal text-[#6b7280]">
                          {certificate.platformSignatureTitle || "Nền tảng học tập cá nhân hoá"}
                        </p>
                      </div>
                      <div className="flex flex-col items-center">
                        {certificate.issuerSignatureUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={certificate.issuerSignatureUrl}
                            alt=""
                            className="mb-1 h-6 max-w-[84px] object-contain"
                          />
                        )}
                        <div className="mb-1.5 h-[0.75px] w-[110px] bg-[#a3a3a3]" />
                        <div className="flex items-center gap-1.5">
                          {certificate.issuerLogoUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={certificate.issuerLogoUrl}
                              alt=""
                              className="h-[18px] w-[18px] object-contain"
                            />
                          )}
                          <p className="text-sm font-bold leading-normal text-[#1f2937]">
                            {certificate.issuerSignatureName || certificate.issuerOrgName}
                          </p>
                        </div>
                        {certificate.issuerSignatureTitle && (
                          <p className="mt-0.5 text-[9.5px] leading-normal text-[#6b7280]">
                            {certificate.issuerSignatureTitle}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      {certificate.platformSignatureUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={certificate.platformSignatureUrl}
                          alt=""
                          className="mb-1 h-6 max-w-[84px] object-contain"
                        />
                      )}
                      <div className="mb-1.5 h-[0.75px] w-[110px] bg-[#a3a3a3]" />
                      <p className="text-sm font-bold leading-normal text-[#1f2937]">
                        {certificate.platformSignatureName || certificate.issuerName}
                      </p>
                      <p className="mt-0.5 text-[9.5px] leading-normal text-[#6b7280]">
                        {certificate.platformSignatureTitle || "Nền tảng học tập cá nhân hoá"}
                      </p>
                    </div>
                  )}
                  <CertificateSeal />
                </div>

                <p className="mt-3.5 w-full text-center text-[11.25px] leading-normal text-[#9ca3af]">
                  Mã chứng nhận: <span className="text-[12.75px] text-[#6b7280]">{certificate.certNumber}</span>
                  {"   ·   "}
                  Xác thực tại: <span className="text-[12.75px] text-[#6b7280]">{verifyUrl}</span>
                </p>
              </div>
            </div>
          </div>
        </article>
      </CertificateCanvas>

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
