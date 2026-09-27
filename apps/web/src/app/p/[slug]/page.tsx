import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicPortfolio } from "@feedbackme/core-lms";
import UserAvatar from "@/components/ui/UserAvatar";
import PortfolioAttachment from "@/components/portfolio/PortfolioAttachment";
import { formatDate } from "@/lib/datetime";

// A8 — trang trưng bày công khai. Cache ISR; API sửa hồ sơ gọi revalidatePath
// nên thay đổi (kể cả tắt công khai) có hiệu lực ngay. 5 phút là trần cho các
// thay đổi đi đường khác (GV chấm lại, học viên đổi tên hiển thị).
export const revalidate = 300;

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getPublicPortfolio(params.slug);
  return {
    title: p ? `Portfolio — ${p.displayName}` : "Không tìm thấy",
    robots: { index: false, follow: false },
  };
}

const BODY_PREVIEW = 400;

export default async function PublicPortfolioPage({ params }: Props) {
  const p = await getPublicPortfolio(params.slug);
  if (!p) notFound();

  const empty = p.groups.length === 0 && p.completedCourses.length === 0;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 lg:px-6">
      <header className="flex items-center gap-4">
        <UserAvatar name={p.displayName} imageUrl={p.avatarUrl} size="xl" />
        <div className="min-w-0">
          <h1 className="text-h1 break-words">{p.displayName}</h1>
          {p.headline && <p className="mt-1 text-body text-muted">{p.headline}</p>}
        </div>
      </header>

      {p.completedCourses.length > 0 && (
        <section className="mt-8">
          <h2 className="text-h3">Khoá học đã hoàn thành</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {p.completedCourses.map((c) => (
              <li key={c.title + c.completedAt.toISOString()} className="chip-success">
                {c.title} · {formatDate(c.completedAt)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {p.groups.map((g) => (
        <section key={g.title} className="mt-8">
          <h2 className="text-h3">{g.title}</h2>
          <ul className="mt-3 space-y-4">
            {g.items.map((it) => (
              <li key={it.submissionId} className="card p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-h4">{it.title}</h3>
                  <span className="chip-brand" title="Bài nộp đã được giáo viên chấm trên Limio">
                    ✓ GV đã chấm{it.gradedAt && ` · ${formatDate(it.gradedAt)}`}
                  </span>
                </div>
                {it.note && <p className="mt-2 text-body italic">“{it.note}”</p>}
                {it.body.trim() &&
                  (it.body.length > BODY_PREVIEW ? (
                    <details className="group mt-3">
                      <summary className="cursor-pointer list-none whitespace-pre-wrap break-words text-sm">
                        <span className="group-open:hidden">{it.body.slice(0, BODY_PREVIEW)}… </span>
                        <span className="text-brand-600 group-open:hidden">Xem hết</span>
                        <span className="hidden text-brand-600 group-open:inline">Thu gọn</span>
                      </summary>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm">{it.body}</p>
                    </details>
                  ) : (
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm">{it.body}</p>
                  ))}
                <PortfolioAttachment url={it.attachmentUrl} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {empty && <p className="mt-10 text-center text-meta">Portfolio này chưa có bài nào.</p>}

      <footer className="mt-12 border-t border-token pt-4 text-center text-caption">
        Portfolio tạo trên Limio
      </footer>
    </main>
  );
}
