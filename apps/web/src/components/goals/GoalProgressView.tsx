import { GOAL_PACE_LABEL, LANGUAGE_SKILL_LABEL, MASTERY_LABEL_TEXT } from "@feedbackme/shared-types";
import type { GoalProgress } from "@feedbackme/core-feedback";

const LABEL_CLASS: Record<string, string> = {
  solid: "chip-success",
  practice_more: "chip-accent",
  needs_review: "chip-danger",
  no_data: "chip",
};

const PACE_CLASS: Record<string, string> = {
  ahead: "banner-success",
  on_track: "banner-success",
  behind: "banner-warning",
  overdue: "banner-warning",
  too_early: "banner-info",
  no_hours_target: "banner-info",
};

const REASON_TEXT: Record<string, string> = {
  personalization_off: "Khoá học này chưa bật theo dõi tiến độ cá nhân.",
  control_variant: "Lớp này đang không dùng phần theo dõi tiến độ cá nhân.",
};

/** Hiển thị tiến độ theo mục tiêu: số tuần còn lại, nhận định, giờ học, và nhãn từng kỹ năng. Không có % mastery. */
export default function GoalProgressView({ progress, hoursPerWeek }: { progress: GoalProgress; hoursPerWeek: number | null }) {
  const { pace } = progress;
  // Kỹ năng mà khoá không có bài nào (0/0) thì không có gì để nói, ẩn đi cho gọn.
  const skills = progress.skills?.filter((s) => s.lessonsTotal > 0) ?? [];
  return (
    <div className="mt-3 space-y-3">
      <p className="text-sm text-muted">
        {progress.weeksLeft == null
          ? "Chưa có hạn."
          : progress.daysLeft != null && progress.daysLeft < 0
            ? "Đã qua hạn."
            : progress.weeksLeft === 0
              ? "Hạn trong tuần này."
              : `Còn khoảng ${progress.weeksLeft} tuần.`}{" "}
        Đã học khoảng {pace.actualHours} giờ kể từ khi đặt mục tiêu
        {pace.expectedHours != null && hoursPerWeek != null ? ` (kế hoạch ${hoursPerWeek} giờ/tuần, đến nay khoảng ${pace.expectedHours} giờ)` : ""}.
      </p>
      <p className={`${PACE_CLASS[pace.status] ?? "banner-info"} text-sm`}>{GOAL_PACE_LABEL[pace.status]}</p>

      {progress.reason && <p className="text-meta text-muted">{REASON_TEXT[progress.reason] ?? ""}</p>}

      {skills.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2" aria-label="Tiến độ theo kỹ năng">
          {skills.map((s) => (
            <li key={s.skill} className="flex items-center justify-between rounded-lg border border-token px-3 py-2 text-sm">
              <span>
                {LANGUAGE_SKILL_LABEL[s.skill]}
                <span className="ml-2 text-meta text-faint">{s.lessonsPracticed}/{s.lessonsTotal} bài đã luyện</span>
              </span>
              <span className={`${LABEL_CLASS[s.label]} text-xs`}>{MASTERY_LABEL_TEXT[s.label]}</span>
            </li>
          ))}
        </ul>
      )}
      {progress.overall && (
        <div className="flex items-center justify-between rounded-lg border border-token px-3 py-2 text-sm">
          <span>
            Tổng quan
            <span className="ml-2 text-meta text-faint">{progress.overall.lessonsPracticed}/{progress.overall.lessonsTotal} bài đã luyện</span>
          </span>
          <span className={`${LABEL_CLASS[progress.overall.label]} text-xs`}>{MASTERY_LABEL_TEXT[progress.overall.label]}</span>
        </div>
      )}
    </div>
  );
}
