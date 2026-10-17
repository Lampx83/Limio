import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireFeature } from "@/lib/session";
import { prisma } from "@feedbackme/db";
import { getLiveSessionResults, type LiveSlideResult } from "@feedbackme/core-lms";
import DateTime from "@/components/ui/DateTime";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";
import BoardNotesView from "../../../BoardNotesView";

export const metadata = {
  title: "Kết quả lượt trình chiếu | Limio",
};

const LETTERS = ["A", "B", "C", "D", "E", "F"];

function PollResult({ slide }: { slide: Extract<LiveSlideResult, { kind: "poll" | "quiz" }> }) {
  return (
    <div>
      <div className="mt-1 text-sm text-muted">{slide.totalVotes} phiếu</div>
      <div className="mt-3 space-y-2">
        {slide.options.map((o, idx) => {
          const pct = slide.totalVotes > 0 ? Math.round((o.count / slide.totalVotes) * 100) : 0;
          return (
            <div key={idx}>
              <div className="flex items-baseline gap-2 text-sm">
                <span className="w-4 shrink-0 font-bold text-muted">{LETTERS[idx]}</span>
                <span className="min-w-0 flex-1 truncate">
                  {o.text}
                  {slide.kind === "quiz" && o.correct && <span className="ml-2 text-xs text-success-700">✓ đáp án đúng</span>}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {o.count} · {pct}%
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[rgb(var(--surface-muted))]">
                <div
                  className={`h-full rounded-full ${slide.kind === "quiz" && o.correct ? "bg-green-500" : "bg-brand-500"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WordCloudResult({ slide }: { slide: Extract<LiveSlideResult, { kind: "word_cloud" }> }) {
  return (
    <div>
      <div className="mt-1 text-sm text-muted">{slide.totalSubmissions} bài nộp</div>
      {slide.phrases.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Chưa có bài nộp nào.</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {slide.phrases.map((p) => (
            <span
              key={p.phrase}
              className="rounded-full bg-[rgb(var(--surface-muted))] px-3 py-1 text-sm"
            >
              {p.phrase} <span className="font-semibold tabular-nums text-muted">×{p.count}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function BoardResult({ slide }: { slide: Extract<LiveSlideResult, { kind: "collaborate_board" }> }) {
  const columns = Array.from(new Set(slide.notes.map((n) => n.column).filter((c): c is string => !!c)));
  return (
    <div>
      {slide.prompt && <p className="mt-1 text-sm text-muted">{slide.prompt}</p>}
      <div className="mt-1 text-sm text-muted">{slide.notes.length} ghi chú</div>
      <div className="mt-3">
        <BoardNotesView
          notes={slide.notes.map((n, i) => ({
            id: `${i}`,
            authorName: n.authorName,
            content: n.content,
            column: n.column,
          }))}
          columns={columns}
          scale="editor"
          emptyText="Chưa có ghi chú nào."
        />
      </div>
    </div>
  );
}

function WhiteboardResult({ slide }: { slide: Extract<LiveSlideResult, { kind: "whiteboard" }> }) {
  return (
    <div>
      <p className="mt-1 text-sm text-muted">Mã bảng: {slide.code}</p>
      <Link
        href={`/whiteboard/${slide.code}`}
        className="mt-3 inline-block text-sm font-semibold text-brand-600 hover:underline"
      >
        Mở bảng trắng →
      </Link>
    </div>
  );
}

// Tách ra component riêng để TypeScript thu hẹp đúng kiểu theo `kind` (switch, không chuỗi ternary).
function SlideBody({ slide }: { slide: LiveSlideResult }) {
  switch (slide.kind) {
    case "poll":
    case "quiz":
      return (
        <>
          <h2 className="mt-1 font-semibold">{slide.question}</h2>
          {slide.slideChanged && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Slide này đã được sửa sau buổi dạy. Kết quả bên dưới theo câu hỏi và phương án lúc trình chiếu
              {slide.kind === "quiz" ? "; đáp án đúng của buổi này không còn được hiển thị." : "."}
            </p>
          )}
          <PollResult slide={slide} />
        </>
      );
    case "word_cloud":
      return (
        <>
          <h2 className="mt-1 font-semibold">{slide.prompt}</h2>
          <WordCloudResult slide={slide} />
        </>
      );
    case "collaborate_board":
      return (
        <>
          <h2 className="mt-1 font-semibold">{slide.title}</h2>
          <BoardResult slide={slide} />
        </>
      );
    case "whiteboard":
      return (
        <>
          <h2 className="mt-1 font-semibold">{slide.title}</h2>
          <WhiteboardResult slide={slide} />
        </>
      );
  }
}

const KIND_LABEL: Record<LiveSlideResult["kind"], string> = {
  poll: "Vote",
  quiz: "Quiz",
  word_cloud: "Word cloud",
  collaborate_board: "Padlet",
  whiteboard: "Whiteboard",
};

export default async function LiveSessionHistoryDetailPage({
  params,
}: {
  params: { deckId: string; sessionId: string };
}) {
  const userId = await requireFeature("limio_live.access");
  if (!userId) redirect("/instructor/dashboard?blocked=limio_live");

  const results = await getLiveSessionResults(params.sessionId, userId, prisma).catch(() => null);
  if (!results || results.deckId !== params.deckId) notFound();

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <div className="border-b border-token pb-4">
        <Link
          href={`/instructor/limio-live/${params.deckId}/history`}
          className="text-sm text-muted hover:text-brand-600"
        >
          ← Lịch sử tương tác
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{results.deckTitle}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-muted">
          <DateTime value={results.startedAt.toISOString()} format="datetime" />
          <StatusBadge tone={results.endedAt ? "neutral" : "success"} pulse={!results.endedAt}>
            {results.endedAt ? "Đã kết thúc" : "Đang mở"}
          </StatusBadge>
        </div>
      </div>

      {results.slides.length === 0 ? (
        <EmptyState
          title="Lượt này chưa có tương tác nào"
          description="Không có slide tương tác nào được mở trong lượt trình chiếu này."
        />
      ) : (
        <div className="space-y-4">
          {results.slides.map((slide, i) => (
            <section key={slide.slideId} className="rounded-xl border border-token bg-[rgb(var(--surface))] p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-faint">
                <span>Slide {i + 1}</span>
                <span>· {KIND_LABEL[slide.kind]}</span>
              </div>
              <SlideBody slide={slide} />
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
