import type { MockSkillSummary } from "@feedbackme/core-lms";
import { LANGUAGE_SKILL_LABEL, isLanguageSkill } from "@feedbackme/shared-types";

const TREND = {
  up: { text: "▲ tăng", cls: "text-emerald-700" },
  down: { text: "▼ giảm", cls: "text-red-700" },
  same: { text: "＝ không đổi", cls: "text-faint" },
} as const;

/**
 * LANG G5d.6 — khối "Thi thử" trên hồ sơ 4 kỹ năng. TÁCH HẲN khỏi nhãn Cần ôn / Nên luyện / Vững:
 * đó là nhãn từ mô hình người học (BKT), còn đây là kết quả của một lượt thi thử. Chưa có đường
 * từ bài thi sang BKT nên không trộn hai thứ.
 */
export default function MockSkillBlock({ summary }: { summary: MockSkillSummary }) {
  return (
    <section className="rounded-xl border border-token bg-[rgb(var(--surface))] p-4" data-testid="mock-skill-block">
      <h2 className="text-h3">Thi thử</h2>
      <p className="text-meta mt-1">
        {summary.examTitle} · lượt gần nhất{summary.attemptCount > 1 ? `, so với lượt trước (đã thi ${summary.attemptCount} lần)` : ""}. Đây là kết quả bài
        thi thử, tách riêng khỏi nhãn kỹ năng ở trên.
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {summary.skills.map((s) => {
          const label = isLanguageSkill(s.skill) ? LANGUAGE_SKILL_LABEL[s.skill] : s.skill;
          return (
            <li key={s.skill} className="flex items-center justify-between rounded border border-token px-3 py-2 text-sm">
              <span className="font-medium">{label}</span>
              <span className="tabular-nums">
                {s.pending ? (
                  <span className="text-amber-700">Chờ chấm</span>
                ) : s.pct === null ? (
                  "—"
                ) : (
                  <>
                    {s.pct}%
                    {s.trend && <span className={`ml-2 text-xs ${TREND[s.trend].cls}`}>{TREND[s.trend].text}</span>}
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
