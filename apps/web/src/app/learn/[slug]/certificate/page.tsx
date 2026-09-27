import BadgeIcon from "@/components/ui/BadgeIcon";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { getCourseProgress, isUserEnrolled, issueCertificate } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { formatVN } from "@/lib/datetime";

export const dynamic = "force-dynamic";

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

      <article className="relative mt-6 overflow-hidden rounded-3xl border-4 border-double border-accent-400 bg-gradient-to-br from-accent-50 via-white to-brand-50 p-10 text-center shadow-card-hover sm:p-14 print:border-2 print:shadow-none">
        {/* Decorative corner glows */}
        <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-accent-200/40 blur-3xl" aria-hidden />
        <div className="absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-brand-200/40 blur-3xl" aria-hidden />

        <div className="relative">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-1 text-xs font-bold uppercase tracking-[0.3em] text-accent-700 backdrop-blur">
            Chứng nhận hoàn thành
          </p>

          <h1 className="mt-8 h-display text-xl font-medium text-muted">
            Chứng nhận này được trao cho
          </h1>
          <p className="mt-3 h-display text-4xl font-bold tracking-tight sm:text-5xl">
            <span className="text-gradient">{certificate.userNameSnapshot}</span>
          </p>
          <p className="mt-6 text-base text-muted">
            đã hoàn thành xuất sắc khóa học
          </p>
          <p className="mt-2 h-display text-2xl font-semibold sm:text-3xl">
            {course.title}
          </p>
          {course.description && (
            <p className="mx-auto mt-3 max-w-xl text-sm italic text-faint">
              {course.description.length > 200
                ? course.description.slice(0, 200) + "…"
                : course.description}
            </p>
          )}

          {skillBadges.length > 0 && (
            <div className="mt-8">
              <p className="text-xs font-semibold uppercase tracking-wide text-faint">
                Skill master đã đạt
              </p>
              <ul className="mt-3 flex flex-wrap justify-center gap-2">
                {skillBadges.map((sb) => (
                  <li
                    key={sb.id}
                    className="inline-flex items-center gap-1 rounded-full border border-accent-200 bg-accent-50 px-3 py-1 text-xs font-semibold text-accent-700"
                  >
                    <BadgeIcon code={sb.badge.code} className="h-9 w-9" />
                    {sb.badge.name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-12 grid grid-cols-2 gap-6 border-t border-accent-200 pt-6 text-sm">
            <div className="text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-faint">
                Hoàn thành ngày
              </p>
              <p className="mt-1 font-semibold">{issuedAtLabel}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-faint">
                Mã chứng nhận
              </p>
              <p className="mt-1 font-mono text-xs">{certificate.certNumber}</p>
            </div>
          </div>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-faint">
            {certificate.issuerLogoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={certificate.issuerLogoUrl} alt="" className="h-4 w-4 object-contain" />
            )}
            Cấp bởi {certificate.issuerName}
          </p>
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
