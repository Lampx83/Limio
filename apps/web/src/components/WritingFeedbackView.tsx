import { CATEGORY_LABEL, CRITERION_LABEL, LEVEL_LABEL } from "@/lib/writingFeedbackText";

export interface WritingFeedbackBody {
  summary: string;
  criteria: { key: string; level: string; comment: string }[];
  errors: { id: string; category: string; quote: string; correction: string; explanation: string }[];
  nextSteps: string[];
}

/**
 * LANG G6 — hiển thị một bản góp ý bài viết. Mọi chữ (tóm tắt, trích đoạn, bản sửa, giải thích) là text
 * node — React tự thoát HTML. Không bao giờ hiện số điểm (chỉ ba mức).
 */
export default function WritingFeedbackView({
  body,
  review,
  reviewerNote,
}: {
  body: WritingFeedbackBody;
  review: "unreviewed" | "approved";
  reviewerNote?: string | null;
}) {
  return (
    <div className="space-y-4" data-testid="writing-feedback-view">
      {review === "unreviewed" ? (
        <p className="banner-warning text-sm" role="note">
          <b>Chưa được giảng viên duyệt.</b> Góp ý này do AI tạo nên có thể sai hoặc chưa phù hợp — hãy đối chiếu với giáo
          trình và hỏi giảng viên khi nghi ngờ.
        </p>
      ) : (
        <p className="banner-success text-sm" role="note">
          <b>Giảng viên đã duyệt</b> góp ý này.
        </p>
      )}
      {review === "approved" && reviewerNote && (
        <p className="rounded border border-token px-3 py-2 text-sm">
          <span className="font-medium">Ghi chú của giảng viên: </span>
          {reviewerNote}
        </p>
      )}

      {body.summary && <p className="text-body">{body.summary}</p>}

      {body.criteria.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2" aria-label="Các tiêu chí">
          {body.criteria.map((c) => {
            const lv = LEVEL_LABEL[c.level];
            return (
              <li key={c.key} className="rounded border border-token px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{CRITERION_LABEL[c.key] ?? c.key}</span>
                  {lv && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${lv.cls}`}>{lv.text}</span>}
                </div>
                {c.comment && <p className="text-meta mt-1">{c.comment}</p>}
              </li>
            );
          })}
        </ul>
      )}

      <section aria-label="Các lỗi cần sửa">
        <h4 className="text-sm font-semibold">Lỗi cần sửa ({body.errors.length})</h4>
        {body.errors.length === 0 ? (
          <p className="text-meta mt-1">Không thấy lỗi nào cần sửa trong bài này.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {body.errors.map((e) => (
              <li key={e.id} className="rounded border border-token px-3 py-2 text-sm">
                <span className="mb-1 inline-block rounded bg-[rgb(var(--surface-muted))] px-2 py-0.5 text-xs text-muted">
                  {CATEGORY_LABEL[e.category] ?? e.category}
                </span>
                <p>
                  <span className="rounded bg-red-50 px-1 text-red-800 line-through decoration-red-400">{e.quote}</span>
                  <span aria-hidden> → </span>
                  <span className="rounded bg-emerald-50 px-1 font-medium text-emerald-800">{e.correction}</span>
                </p>
                {e.explanation && <p className="text-meta mt-1">{e.explanation}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {body.nextSteps.length > 0 && (
        <section aria-label="Nên luyện tiếp">
          <h4 className="text-sm font-semibold">Nên luyện tiếp</h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {body.nextSteps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
