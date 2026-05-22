import { notFound } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { isAdmin } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";

export const revalidate = 30;
export const metadata = { title: "Changelog hệ thống" };

// ── Minimal markdown → HTML (không dùng heavy library) ──────────────────
function renderMarkdown(md: string): string {
  return md
    // Headings
    .replace(/^#### (.+)$/gm, "<h4 class=\"text-sm font-semibold mt-3 mb-1\">$1</h4>")
    .replace(/^### (.+)$/gm, "<h3 class=\"text-base font-semibold mt-4 mb-1.5\">$1</h3>")
    .replace(/^## (.+)$/gm, "<h2 class=\"text-lg font-bold mt-5 mb-2\">$1</h2>")
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Inline code
    .replace(/`([^`]+)`/g, "<code class=\"rounded bg-[rgb(var(--surface-muted))] px-1 py-0.5 font-mono text-xs\">$1</code>")
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<a href=\"$2\" class=\"link text-xs\" target=\"_blank\" rel=\"noopener\">$1</a>")
    // List items
    .replace(/^- (.+)$/gm, "<li class=\"ml-4 list-disc text-sm\">$1</li>")
    // Horizontal rule
    .replace(/^---$/gm, "<hr class=\"my-3 border-token\" />")
    // Paragraph (blank lines)
    .replace(/\n{2,}/g, "</p><p class=\"text-sm text-muted\">")
    // Wrap list items
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, (m) => `<ul class="space-y-0.5 my-1">${m}</ul>`);
}

// ── Màu badge theo loại release ─────────────────────────────────────────
function tagColor(tag: string) {
  // Tất cả đều là deploy tag, dùng màu neutral
  return "chip";
}

export default async function AdminChangelogPage() {
  const session = await auth();
  if (!session?.user?.id) notFound();
  const admin = await isAdmin(session.user.id);
  if (!admin) notFound();

  const releases = await prisma.systemRelease.findMany({
    orderBy: { deployedAt: "desc" },
    take: 50,
    select: { id: true, tag: true, sha: true, body: true, deployedAt: true },
  });

  // Format ngày theo locale VN
  function formatDate(d: Date) {
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date(d));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Changelog hệ thống</h1>
        <p className="mt-1 text-sm text-muted">
          Lịch sử deploy lên production — được ghi tự động sau mỗi lần CI/CD
          hoàn thành.
        </p>
      </div>

      {releases.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-token bg-[rgb(var(--surface-muted))/0.4] px-6 py-12 text-center">
          <p className="text-4xl" aria-hidden>📋</p>
          <p className="mt-3 font-semibold">Chưa có release nào được ghi lại.</p>
          <p className="mt-1 text-sm text-muted">
            Sau lần deploy đầu tiên, changelog sẽ tự động xuất hiện ở đây.
          </p>
        </div>
      ) : (
        <ol className="relative border-l-2 border-token pl-6 space-y-8">
          {releases.map((r, i) => (
            <li key={r.id} className="relative">
              {/* Timeline dot */}
              <span
                className={`absolute -left-[1.4rem] top-1.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-token ${
                  i === 0 ? "bg-success-500 border-success-500" : "bg-[rgb(var(--surface))]"
                }`}
              />

              {/* Header */}
              <div className="flex flex-wrap items-center gap-2">
                <span className={tagColor(r.tag)}>
                  {r.tag}
                </span>
                {i === 0 && (
                  <span className="chip-success text-xs">latest</span>
                )}
                <time className="text-xs text-faint" dateTime={r.deployedAt.toISOString()}>
                  {formatDate(r.deployedAt)}
                </time>
                <a
                  href={`https://github.com/Lampx83/FeedBackMe/commit/${r.sha}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link font-mono text-xs"
                >
                  {r.sha.substring(0, 7)}
                </a>
              </div>

              {/* Changelog body */}
              <div
                className="prose-sm mt-3 rounded-xl border border-token bg-[rgb(var(--surface))] p-4 text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(r.body) }}
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
