import { getMyMeetingSummaries, listMyMeetingNotes } from "@feedbackme/core-lms";
import { formatVN } from "@/lib/datetime";

/**
 * CENTER C4.4/C4.16 — học viên đọc lại tổng kết buổi và nhận xét của giáo viên ngay trong ứng dụng (kể cả khi đã
 * tắt email). Chỉ trả buổi của lớp mình và nhận xét ĐÃ GỬI của chính mình; không có nháp hay dữ liệu soạn.
 */
const topicOf = (planTitle: string | null) => planTitle?.replace(/^Buổi\s*\d+\s*[:.\-–—]\s*/i, "").trim() || null;

export default async function MyClassFeed({ userId }: { userId: string }) {
  const [notes, summaries] = await Promise.all([listMyMeetingNotes(userId, 10), getMyMeetingSummaries(userId, 5)]);
  if (notes.length === 0 && summaries.length === 0) return null;

  return (
    <section className="space-y-4" aria-label="Nhận xét và tổng kết sau buổi học">
      {notes.length > 0 && (
        <div className="card p-4">
          <h2 className="text-h3">Nhận xét của giáo viên</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {notes.map((n) => (
              <li key={n.noteId} className="rounded-lg border border-token p-3">
                <p className="text-meta text-muted">
                  {n.correction ? "Đính chính · " : ""}
                  {n.sectionName} · Buổi {n.seq ?? "dạy bù"}
                  {topicOf(n.planTitle) ? ` — ${topicOf(n.planTitle)}` : ""} · {formatVN(n.sentAt, { day: "2-digit", month: "2-digit", year: "numeric" })}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-body">{n.body}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {summaries.length > 0 && (
        <div className="card p-4">
          <h2 className="text-h3">Tổng kết các buổi gần đây</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {summaries.map((s) => (
              <li key={s.meetingId} className="rounded-lg border border-token p-3">
                <p className="font-semibold">
                  Buổi {s.seq ?? "dạy bù"}
                  {topicOf(s.planTitle) ? `: ${topicOf(s.planTitle)}` : ""}
                  <span className="ml-2 text-meta font-normal text-muted">
                    {s.sectionName} · {formatVN(s.startsAt, { day: "2-digit", month: "2-digit", year: "numeric" })}
                  </span>
                </p>
                {s.summary.lessons.length > 0 && (
                  <p className="mt-1 text-sm">
                    <span className="font-semibold">Đã học: </span>
                    {s.summary.lessons.map((l) => l.title).join("; ")}
                  </p>
                )}
                {s.summary.vocab.length > 0 && (
                  <p className="mt-1 text-sm">
                    <span className="font-semibold">Từ vựng cần ôn: </span>
                    {s.summary.vocab.map((v) => `${v.term}${v.reading ? ` (${v.reading})` : ""} — ${v.meaning}`).join("; ")}
                  </p>
                )}
                {s.summary.homework.length > 0 && (
                  <p className="mt-1 text-sm">
                    <span className="font-semibold">Bài tập về nhà: </span>
                    {s.summary.homework
                      .map((h) => `${h.title}${h.dueAt ? ` (hạn ${formatVN(h.dueAt, { day: "2-digit", month: "2-digit" })})` : ""}`)
                      .join("; ")}
                  </p>
                )}
                {s.summary.next && (
                  <p className="mt-1 text-sm text-muted">
                    Buổi tiếp theo: {formatVN(s.summary.next.startsAt, { weekday: "long", day: "2-digit", month: "2-digit" })}
                    {s.summary.next.planTitle ? ` — ${s.summary.next.planTitle}` : ""}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
