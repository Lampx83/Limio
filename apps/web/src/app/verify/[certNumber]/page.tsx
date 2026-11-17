import type { Metadata } from "next";
import { cookies } from "next/headers";
import { prisma } from "@feedbackme/db";
import { getCertificateByNumber } from "@feedbackme/core-lms";
import { LANG_COOKIE, resolveUiLang, translate, type TParams, type UiLang } from "@/lib/i18n/core";
import { EN, VI, type MessageKey } from "@/lib/i18n/dict";
import { resolveTimeZone } from "@/lib/datetime";
import { M4A_COURSES } from "@/lib/micro4asia";
import { CERT_STRINGS } from "@/lib/certificateFormat";
import EmptyState from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

type Props = { params: { certNumber: string } };

/**
 * Ngôn ngữ trang: lựa chọn tay (cookie) thắng; không có thì theo ngôn ngữ của khoá cấp chứng nhận — người xác minh
 * chứng nhận của một khoá tiếng Anh (vd. nhà tuyển dụng, đoàn đánh giá quốc tế) thấy trang tiếng Anh.
 */
async function pageLang(courseId: string | null): Promise<UiLang> {
  const cookie = cookies().get(LANG_COOKIE)?.value;
  const course = courseId
    ? await prisma.course.findUnique({ where: { id: courseId }, select: { language: true } }).catch(() => null)
    : null;
  return resolveUiLang({ cookie, courseLanguage: course?.language ?? null });
}
const tFor = (lang: UiLang) => (key: MessageKey, params?: TParams) => translate(VI, EN, lang, key, params);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const cert = await getCertificateByNumber(params.certNumber);
  const t = tFor(await pageLang(cert?.courseId ?? null));
  return {
    title: cert ? t("learn.verify.title", { name: cert.userNameSnapshot }) : t("learn.verify.notFound"),
    robots: { index: false, follow: false },
  };
}

// A6 — Trang xác thực công khai, không đòi hỏi đăng nhập: bất kỳ ai cầm mã
// chứng nhận (in trên PDF, hoặc dán link vào LinkedIn) đều tra được. Chỉ trả
// về đúng những gì bản thân tấm chứng nhận đã công khai — tên, khoá học,
// ngày cấp — không có điểm số hay dữ liệu learner model nào khác (§5.4).
export default async function VerifyCertificatePage({ params }: Props) {
  const cert = await getCertificateByNumber(params.certNumber);
  const lang = await pageLang(cert?.courseId ?? null);
  const t = tFor(lang);

  if (!cert) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 lg:px-6">
        <EmptyState title={t("learn.verify.notFound")} description={t("learn.verify.notFoundDesc", { code: params.certNumber })} />
      </main>
    );
  }

  const slug = cert.courseId
    ? (await prisma.course.findUnique({ where: { id: cert.courseId }, select: { slug: true } }).catch(() => null))?.slug
    : null;
  const isM4a = !!slug && M4A_COURSES.some((c) => c.slug === slug);
  const issued = new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "vi-VN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: resolveTimeZone(),
  }).format(cert.issuedAt);

  return (
    <main className="mx-auto max-w-lg px-4 py-16 lg:px-6" lang={lang}>
      <div className="card p-8 text-center">
        <p className="banner-success inline-flex items-center gap-2 rounded-full px-4 py-1 text-xs font-bold uppercase tracking-wide">
          ✓ {t("learn.verify.valid")}
        </p>
        <p className="mt-6 text-h1">{cert.userNameSnapshot}</p>
        <p className="mt-2 text-body text-muted">{t("learn.verify.completed")}</p>
        <p className="mt-1 text-h3">{cert.courseTitleSnapshot}</p>
        <div className="mt-8 grid grid-cols-2 gap-4 border-t border-token pt-6 text-left text-sm">
          <div>
            <p className="text-meta">{t("learn.verify.issuedOn")}</p>
            <p className="mt-1 font-semibold">{issued}</p>
          </div>
          <div>
            <p className="text-meta">{t("learn.verify.certNumber")}</p>
            <p className="mt-1 font-mono text-xs">{cert.certNumber}</p>
          </div>
        </div>
        {isM4a && <p className="mt-6 border-t border-token pt-4 text-caption text-muted">{t("learn.verify.m4a")}</p>}
      </div>
      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-caption">
        {cert.issuerLogoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cert.issuerLogoUrl} alt="" className="h-4 w-4 object-contain" />
        )}
        {t("learn.verify.issuedBy", {
          issuer: isM4a
            ? `${CERT_STRINGS[lang].m4aIssuerName}, ${CERT_STRINGS[lang].m4aIssuerCaption}`
            : cert.issuerName,
        })}
      </p>
    </main>
  );
}
