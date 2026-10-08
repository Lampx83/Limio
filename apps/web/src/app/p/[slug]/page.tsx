import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicPortfolio, type PublicPortfolio } from "@feedbackme/core-lms";
import UserAvatar from "@/components/ui/UserAvatar";
import PortfolioAttachment from "@/components/portfolio/PortfolioAttachment";
import { formatDate } from "@/lib/datetime";

// A8 — trang trưng bày công khai. Cache ISR; API sửa hồ sơ gọi revalidatePath
// nên thay đổi (kể cả tắt công khai) có hiệu lực ngay. 5 phút là trần cho các
// thay đổi đi đường khác (GV chấm lại, học viên đổi tên hiển thị).
export const revalidate = 300;

type Props = { params: { slug: string } };
type Group = PublicPortfolio["groups"][number];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getPublicPortfolio(params.slug);
  return {
    title: p ? `Portfolio — ${p.displayName}` : "Không tìm thấy",
    robots: { index: false, follow: false },
  };
}

const BODY_PREVIEW = 400;

// Mỗi khoá một màu: thanh dọc + đường nối + chấm đều dùng chung, để bài tập nhìn là biết thuộc khoá nào.
const ACCENTS = ["#ec4899", "#f59e0b", "#dc2626", "#65a30d", "#6366f1"];
const NEUTRAL_ACCENT = "#64748b";

export default async function PublicPortfolioPage({ params }: Props) {
  const p = await getPublicPortfolio(params.slug);
  if (!p) notFound();

  const courseGroups = p.groups.filter((g) => g.certificate);
  const otherGroups = p.groups.filter((g) => !g.certificate);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 lg:px-6">
      <header className="card bg-brand-gradient-soft p-4 sm:p-6">
        <div className="flex items-center gap-4">
          <UserAvatar name={p.displayName} imageUrl={p.avatarUrl} size="xl" />
          <div className="min-w-0">
            <h1 className="text-h1 break-words">{p.displayName}</h1>
            {p.headline && <p className="mt-1 text-body text-muted">{p.headline}</p>}
          </div>
        </div>
        {p.about && <p className="mt-4 max-w-prose whitespace-pre-wrap break-words text-body">{p.about}</p>}
        {p.workCount > 0 && (
          <p className="mt-3 text-meta">
            <b className="text-brand-700">{p.workCount}</b> sản phẩm nổi bật
          </p>
        )}
      </header>

      {courseGroups.length > 0 && (
        <section className="mt-6">
          <h2 className="text-h3">Khoá học đã hoàn thành</h2>
          <p className="text-meta">Bấm vào chứng nhận để đối chiếu mã trên Limio.</p>
          <div className="mt-3 space-y-3.5">
            {courseGroups.map((g, i) => (
              <GroupCard key={g.key} group={g} accent={ACCENTS[i % ACCENTS.length]!} />
            ))}
          </div>
        </section>
      )}

      {otherGroups.length > 0 && (
        <section className="mt-6">
          <h2 className="text-h3">Hoạt động khác</h2>
          <div className="mt-3 space-y-3.5">
            {otherGroups.map((g) => (
              <GroupCard key={g.key} group={g} accent={NEUTRAL_ACCENT} />
            ))}
          </div>
        </section>
      )}

      {p.groups.length === 0 && <p className="mt-10 text-center text-meta">Portfolio này chưa có nội dung.</p>}

      <footer className="mt-10 border-t border-token pt-4 text-center text-caption">
        <p>
          Khoá học và chứng nhận trên trang này được lấy trực tiếp từ hệ thống Limio. Trang do chính học viên quản lý và
          chọn nội dung công khai.
        </p>
        <p className="mt-1">Portfolio tạo trên Limio</p>
      </footer>
    </main>
  );
}

function GroupCard({ group, accent }: { group: Group; accent: string }) {
  const cert = group.certificate;
  return (
    <article className="card relative overflow-hidden">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ background: accent }} />
      <div className="flex flex-col gap-2.5 py-3.5 pl-6 pr-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] text-white"
            style={{ background: accent }}
          >
            <IconBook />
          </span>
          <div className="min-w-0">
            <h3 className="text-h4 break-words">{group.title}</h3>
            {cert ? (
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-meta">
                <span>Hoàn thành {formatDate(cert.issuedAt)}</span>
                <span className="chip-success" title="Chứng nhận do Limio cấp, tra cứu được bằng mã">
                  ✓ Đã xác thực bởi Limio
                </span>
              </p>
            ) : (
              <p className="mt-0.5 text-meta">Đấu trường</p>
            )}
          </div>
        </div>
        {cert && (
          <a
            href={`/verify/${cert.certNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm shrink-0 !justify-start gap-2 text-left"
            aria-label={`Xem giấy chứng nhận khoá ${group.title}`}
          >
            <IconCertificate />
            <span className="leading-tight">
              <b className="block text-[13px]">Xem giấy chứng nhận</b>
              <span className="block font-mono text-[11px] font-normal text-muted">Mã {cert.certNumber}</span>
            </span>
          </a>
        )}
      </div>

      {group.items.length > 0 && (
        <div className="border-t border-token bg-[rgb(var(--surface-muted))] py-2.5 pl-6 pr-4">
          <div className="ml-[17px] border-l-[3px] pl-4" style={{ borderColor: accent }}>
            <h4 className="relative mb-2 text-sm font-semibold text-muted">
              <span
                aria-hidden
                className="absolute -left-[23px] top-1/2 h-[11px] w-[11px] -translate-y-1/2 rounded-full ring-[3px] ring-[rgb(var(--surface-muted))]"
                style={{ background: accent }}
              />
              {cert ? "Sản phẩm tiêu biểu của khoá" : "Sản phẩm tiêu biểu"}
              {group.items.length > 1 && <span className="font-normal"> · {group.items.length} bài</span>}
            </h4>
            <ul className="space-y-2.5">
              {group.items.map((it) => (
                <WorkCard key={it.submissionId} item={it} accent={accent} />
              ))}
            </ul>
          </div>
        </div>
      )}
    </article>
  );
}

function WorkCard({ item: it, accent }: { item: Group["items"][number]; accent: string }) {
  return (
    <li className="card flex overflow-hidden">
      <div
        aria-hidden
        className="grid w-14 shrink-0 place-items-center text-white sm:w-28"
        style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}
      >
        <IconDocument />
      </div>
      <div className="min-w-0 flex-1 px-3.5 py-2.5">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <h5 className="min-w-0 break-words text-[15px] font-semibold leading-snug">{it.title}</h5>
          {it.gradedAt ? (
            <span className="chip-brand shrink-0" title="Bài nộp đã được giáo viên chấm trên Limio">
              ✓ GV đã chấm · {formatDate(it.gradedAt)}
            </span>
          ) : (
            <span className="shrink-0 text-caption">Nộp {formatDate(it.submittedAt)}</span>
          )}
        </div>
        {it.note && (
          <p className="mt-1.5 border-l-[3px] border-pink-400 bg-pink-50 px-3 py-1.5 text-sm italic text-slate-700 dark:bg-pink-950/30 dark:text-slate-200">
            “{it.note}”
          </p>
        )}
        {it.body.trim() &&
          (it.body.length > BODY_PREVIEW ? (
            <details className="group mt-2">
              <summary className="cursor-pointer list-none whitespace-pre-wrap break-words text-sm">
                <span className="group-open:hidden">{it.body.slice(0, BODY_PREVIEW)}… </span>
                <span className="text-brand-600 group-open:hidden">Xem hết</span>
                <span className="hidden text-brand-600 group-open:inline">Thu gọn</span>
              </summary>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm">{it.body}</p>
            </details>
          ) : (
            <p className="mt-2 whitespace-pre-wrap break-words text-sm">{it.body}</p>
          ))}
        <PortfolioAttachment url={it.attachmentUrl} />
      </div>
    </li>
  );
}

const SVG = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function IconBook() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...SVG}>
      <path d="M4 5h7a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4zM20 5h-7" />
      <path d="M20 5v13h-5" />
    </svg>
  );
}

function IconCertificate() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" className="shrink-0 text-brand-700" {...SVG}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  );
}

function IconDocument() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" {...SVG} strokeWidth={1.6}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  );
}
