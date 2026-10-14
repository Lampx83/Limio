import type { WritingErrorSummary } from "@feedbackme/core-feedback";
import { CATEGORY_LABEL } from "@/lib/writingFeedbackText";

/**
 * LANG G6d — khối "Lỗi hay gặp khi viết" trên hồ sơ 4 kỹ năng. Chỉ tính từ các bản góp ý ĐÃ ĐƯỢC GIẢNG
 * VIÊN DUYỆT trong 8 tuần gần nhất. TÁCH HẲN khỏi nhãn Cần ôn / Nên luyện / Vững.
 */
export default function WritingErrorsBlock({ summary }: { summary: WritingErrorSummary }) {
  const frequent = summary.categories.filter((c) => c.frequent).slice(0, 3);
  return (
    <section className="rounded-xl border border-token bg-[rgb(var(--surface))] p-4" data-testid="writing-errors-block">
      <h2 className="text-h3">Lỗi hay gặp khi viết</h2>
      <p className="text-meta mt-1">
        Tổng hợp từ {summary.feedbackCount} góp ý bài viết đã được giảng viên duyệt trong 8 tuần gần đây. Tách riêng khỏi
        nhãn kỹ năng ở trên.
      </p>
      {frequent.length === 0 ? (
        <p className="text-meta mt-3">
          Chưa có loại lỗi nào lặp lại từ 3 lần trở lên — {summary.totalErrors === 0 ? "bài viết của bạn chưa có lỗi nào được ghi nhận." : "cứ tiếp tục viết và nhận góp ý để thấy rõ hơn."}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {frequent.map((c) => (
            <li key={c.category} className="rounded border border-token px-3 py-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{CATEGORY_LABEL[c.category] ?? c.category}</span>
                <span className="tabular-nums text-faint">
                  {c.count} lần · {Math.round(c.share * 100)}% lỗi
                </span>
              </div>
              {c.examples.map((e, i) => (
                <p key={i} className="text-meta mt-1">
                  <span className="line-through decoration-red-400">{e.quote}</span> → <span className="font-medium">{e.correction}</span>
                </p>
              ))}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
