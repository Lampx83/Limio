import type { PracticeSkillSummary } from "@feedbackme/core-lms";
import { LANGUAGE_SKILL_LABEL, isLanguageSkill } from "@feedbackme/shared-types";

/**
 * LANG G5e.8 — khối "Luyện đề" trên hồ sơ 4 kỹ năng: độ chính xác theo kỹ năng trên đáp án mới
 * nhất của từng câu đã luyện. TÁCH HẲN khỏi nhãn Cần ôn / Nên luyện / Vững và khỏi khối "Thi thử":
 * mỗi câu đã phát event kèm thẻ kỹ năng để sau này nuôi mô hình người học, nhưng hiện CHƯA nuôi.
 */
export default function PracticeSkillBlock({ summary }: { summary: PracticeSkillSummary }) {
  return (
    <section className="rounded-xl border border-token bg-[rgb(var(--surface))] p-4" data-testid="practice-skill-block">
      <h2 className="text-h3">Luyện đề</h2>
      <p className="text-meta mt-1">
        Đã hoàn thành {summary.sessionCount} buổi luyện. Tỉ lệ đúng trên các câu bạn đã luyện, tách riêng khỏi nhãn kỹ năng
        ở trên.
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {summary.skills.map((s) => (
          <li key={s.skill} className="flex items-center justify-between rounded border border-token px-3 py-2 text-sm">
            <span className="font-medium">{isLanguageSkill(s.skill) ? LANGUAGE_SKILL_LABEL[s.skill] : "Khác"}</span>
            <span className="tabular-nums">
              {s.pct}% <span className="text-xs text-faint">({s.correct}/{s.total} câu)</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
