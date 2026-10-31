import Link from "next/link";
import { READINESS_MIN_QUESTIONS, type PersonalizationReadiness } from "@feedbackme/core-lms";

/**
 * AC1 (docs/tieu-chi/tu-hoc-ca-nhan-hoa-nxb.md) — bảng "Sẵn sàng cá nhân hoá". Chỉ thông tin, không chặn gì.
 * Khoá tắt cá nhân hoá thì trang không render panel này.
 */
export default function PersonalizationReadinessPanel({
  courseId,
  readiness,
}: {
  courseId: string;
  readiness: PersonalizationReadiness;
}) {
  const { lessons, standaloneQuizzes } = readiness;
  const thinCount = lessons.filter((l) => l.thin).length;

  return (
    <div className="card space-y-3">
      <header className="border-b border-token pb-3">
        <h3 className="text-base font-semibold">Sẵn sàng cá nhân hoá</h3>
        <p className="mt-0.5 text-xs text-muted">
          Lộ trình và phản hồi riêng cho từng người học dựa trên kết quả quiz gắn với từng bài. Bài càng có nhiều câu,
          càng có lời giải thích và càng khai báo rõ chỗ dễ nhầm thì phản hồi càng giàu. Bảng này chỉ để tham khảo,
          không ảnh hưởng việc publish. "Chỗ nhầm đã khai báo" là số đáp án sai đã gắn tên một kiểu nhầm lẫn.
        </p>
      </header>

      {lessons.length === 0 ? (
        <p className="text-sm text-muted">Khoá chưa có bài nào.</p>
      ) : (
        <>
          <p className={thinCount > 0 ? "banner-info" : "banner-success"}>
            {thinCount > 0
              ? `${thinCount}/${lessons.length} bài còn ít dữ liệu (dưới ${READINESS_MIN_QUESTIONS} câu trong quiz gắn bài).`
              : `Cả ${lessons.length} bài đều có từ ${READINESS_MIN_QUESTIONS} câu trở lên.`}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="py-2 pr-3 font-medium">Bài</th>
                  <th className="px-3 py-2 font-medium">Trạng thái</th>
                  <th className="px-3 py-2 text-right font-medium">Quiz</th>
                  <th className="px-3 py-2 text-right font-medium">Câu hỏi</th>
                  <th className="px-3 py-2 text-right font-medium">Có giải thích</th>
                  <th className="py-2 pl-3 text-right font-medium">Chỗ nhầm đã khai báo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-token">
                {lessons.map((l) => (
                  <tr key={l.lessonId}>
                    <td className="py-2 pr-3">
                      <Link
                        href={`/instructor/courses/${courseId}?tab=content&lesson=${l.lessonId}`}
                        className="link font-medium"
                      >
                        {l.title}
                      </Link>
                      <div className="text-xs text-muted">{l.moduleTitle}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {l.thin ? (
                        <span className="chip-accent">Ít dữ liệu</span>
                      ) : (
                        <span className="chip-success">Đủ dữ liệu</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{l.quizCount}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{l.questionCount}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {l.explainedCount}/{l.questionCount}
                    </td>
                    <td className="py-2 pl-3 text-right tabular-nums">{l.misconceptionCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {standaloneQuizzes.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold">Quiz không gắn bài: không được cá nhân hoá</h4>
          <p className="mt-0.5 text-xs text-muted">
            Kết quả những quiz này không cập nhật mức nắm vững của bài nào. Muốn có lộ trình và phản hồi riêng, hãy
            gắn quiz vào bài học.
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {standaloneQuizzes.map((q) => (
              <li key={q.quizId} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate">{q.title}</span>
                <span className="shrink-0 text-xs text-muted tabular-nums">{q.questionCount} câu</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
