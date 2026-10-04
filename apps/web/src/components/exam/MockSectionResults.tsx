import type { MockAttemptResult } from "@feedbackme/core-lms";
import { LANGUAGE_SKILL_LABEL, isLanguageSkill } from "@feedbackme/shared-types";
import { formatClock } from "@/lib/audioClock";

const TREND: Record<"up" | "down" | "same", { text: string; cls: string; label: string }> = {
  up: { text: "▲", cls: "text-emerald-700", label: "Tăng so với lần trước" },
  down: { text: "▼", cls: "text-red-700", label: "Giảm so với lần trước" },
  same: { text: "＝", cls: "text-faint", label: "Không đổi so với lần trước" },
};

/**
 * LANG G5d — kết quả theo phần của lượt thi thử. Phần còn câu chờ chấm KHÔNG hiện điểm (không
 * điểm giả); ước lượng chỉ có khi giảng viên nhập bảng quy đổi và luôn kèm nhãn "không phải điểm
 * chính thức". Server component thuần hiển thị.
 */
export default function MockSectionResults({ result }: { result: MockAttemptResult }) {
  const hasEstimate = result.sections.some((s) => s.estimate !== null);
  const hasPrev = result.previous !== null;
  return (
    <section className="mt-6 rounded border border-default bg-white p-5" data-testid="mock-section-results">
      <h2 className="mb-3 text-base font-semibold">Kết quả theo phần</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-caption">
            <tr className="border-b border-token">
              <th className="px-2 py-2">Phần</th>
              <th className="px-2 py-2 text-right">Đúng</th>
              <th className="px-2 py-2 text-right">Điểm</th>
              {hasEstimate && <th className="px-2 py-2">Ước lượng*</th>}
              {hasPrev && <th className="px-2 py-2 text-center">So với lần trước</th>}
            </tr>
          </thead>
          <tbody>
            {result.sections.map((s) => {
              const trend = result.trends[s.sectionId];
              const skill = s.languageSkill && isLanguageSkill(s.languageSkill) ? LANGUAGE_SKILL_LABEL[s.languageSkill] : null;
              return (
                <tr key={s.sectionId} className="border-b border-token">
                  <td className="px-2 py-2 font-medium">
                    {s.title}
                    {skill && skill !== s.title && <span className="ml-2 text-xs font-normal text-faint">({skill})</span>}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {s.pending ? "—" : `${s.correctCount}/${s.questionCount}`}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {s.pending ? (
                      <span className="text-amber-700">Chờ giảng viên chấm ({s.pendingCount} câu)</span>
                    ) : (
                      `${s.score}/${s.maxScore}`
                    )}
                  </td>
                  {hasEstimate && <td className="px-2 py-2">{s.estimate ?? "—"}</td>}
                  {hasPrev && (
                    <td className="px-2 py-2 text-center">
                      {trend ? (
                        <span className={TREND[trend].cls} title={TREND[trend].label} aria-label={TREND[trend].label}>
                          {TREND[trend].text}
                        </span>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-faint">
        Thời gian đã dùng: {formatClock(result.timeSpentSec)} trên {formatClock(result.allowedSec)} được phép.
      </p>
      {hasEstimate && (
        <p className="mt-1 text-xs text-faint">
          * Ước lượng theo bảng quy đổi do giảng viên đặt — <b>không phải điểm chính thức</b> của kỳ thi.
        </p>
      )}
    </section>
  );
}
