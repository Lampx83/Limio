import Link from "next/link";
import { BackButton } from "@/components/ui";
import {
  ASSIGNMENT_DEEP_REFLECTION_XP,
  DAILY_CAPS,
  DAILY_QUESTS,
  H5P_COMPLETED_XP,
  LESSON_COMPLETED_XP,
  MISCONCEPTION_RESOLVED_XP,
  QUIZ_FIRST_TRY_BASE_XP,
  QUIZ_RETRY_BASE_XP,
  REFLECTION_MIN_CHARS,
  SPEED_RUN_THRESHOLD_SEC,
} from "@feedbackme/core-gamification";

export const metadata = { title: "Cách tính điểm (XP) — Limio" };

interface Row {
  action: string;
  xp: string;
  cap: string;
  note?: string;
}

const rows: Row[] = [
  {
    action: "Hoàn thành 1 bài học",
    xp: `${LESSON_COMPLETED_XP} XP`,
    cap: `Tối đa ${DAILY_CAPS["lesson.completed"]} lần/ngày`,
  },
  {
    action: "Nộp quiz — lần đầu tiên",
    xp: `${QUIZ_FIRST_TRY_BASE_XP} × độ khó (1–5) × điểm (%)`,
    cap: `Tối đa ${DAILY_CAPS["quiz.passed.first_try"]} lần/ngày`,
    note: "Nhân thêm hệ số 0,5–1,5 tuỳ mức thành thạo kỹ năng của câu hỏi (xem bên dưới).",
  },
  {
    action: "Nộp quiz — làm lại",
    xp: `${QUIZ_RETRY_BASE_XP} × độ khó (1–5) × điểm (%)`,
    cap: `Tối đa ${DAILY_CAPS["quiz.passed.retry"]} lần/ngày`,
    note: "Cùng hệ số thành thạo như lần đầu.",
  },
  {
    action: "Khắc phục 1 lỗi tư duy (misconception)",
    xp: `${MISCONCEPTION_RESOLVED_XP} XP`,
    cap: "Không giới hạn/ngày",
    note: "Chỉ tính 1 lần trọn đời cho mỗi lỗi tư duy.",
  },
  {
    action: "Hoàn thành 1 hoạt động H5P",
    xp: `${H5P_COMPLETED_XP} XP`,
    cap: "Không giới hạn/ngày",
    note: "Chỉ tính 1 lần trọn đời cho mỗi gói H5P.",
  },
  {
    action: "Bài tập tự luận — tự đánh giá + phản hồi sâu",
    xp: `${ASSIGNMENT_DEEP_REFLECTION_XP} XP`,
    cap: `Tối đa ${DAILY_CAPS["assignment.deep_reflection"]} lần/ngày`,
    note: `Cần chọn mức tự tin + viết phản hồi ít nhất ${REFLECTION_MIN_CHARS} ký tự.`,
  },
  ...DAILY_QUESTS.map((q) => ({
    action: `Nhiệm vụ hằng ngày · ${q.emoji} ${q.name}`,
    xp: `${q.rewardXp} XP`,
    cap: "1 lần/ngày",
    note: q.description,
  })),
  {
    action: "Nhiệm vụ trong đấu trường",
    xp: "Tuỳ nhiệm vụ",
    cap: "—",
    note: "Số điểm do giảng viên đặt khi tạo từng nhiệm vụ.",
  },
  {
    action: "Giải thưởng đấu trường (theo hạng)",
    xp: "Tuỳ giải đấu",
    cap: "—",
    note: "Tổng điểm giải chia theo % cho từng hạng, giảng viên cấu hình khi kết thúc giải.",
  },
];

export default function XpGuidePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 lg:px-6">
      <BackButton fallbackHref="/leaderboard" className="mb-4 inline-flex items-center gap-1.5 text-sm text-brand-700 hover:underline" />
      <span className="chip-accent inline-flex items-center gap-1.5">🏆 Gamification</span>
      <h1 className="mt-3 h-display text-3xl font-bold sm:text-4xl">
        Cách tính điểm (XP)
      </h1>
      <p className="mt-3 text-muted">
        Điểm dùng để lên cấp và xếp hạng trên{" "}
        <Link href="/leaderboard" className="link">
          bảng xếp hạng
        </Link>
        . Dưới đây là toàn bộ hoạt động cộng điểm và mức điểm tương ứng.
      </p>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-token">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-token bg-[rgb(var(--surface-muted))] text-xs uppercase text-faint">
            <tr>
              <th className="px-4 py-2.5 font-medium">Hoạt động</th>
              <th className="px-4 py-2.5 font-medium">Điểm</th>
              <th className="px-4 py-2.5 font-medium">Giới hạn</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-token">
            {rows.map((r) => (
              <tr key={r.action}>
                <td className="px-4 py-3 align-top">
                  <p className="font-medium text-[rgb(var(--text))]">{r.action}</p>
                  {r.note && <p className="mt-0.5 text-xs text-faint">{r.note}</p>}
                </td>
                <td className="whitespace-nowrap px-4 py-3 align-top tabular-nums">{r.xp}</td>
                <td className="whitespace-nowrap px-4 py-3 align-top text-muted">{r.cap}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="banner-warning mt-6">
        <p>
          <strong>Chống gian lận:</strong> làm quiz xong trong dưới {SPEED_RUN_THRESHOLD_SEC} giây
          (trả lời quá nhanh để đọc đề) sẽ được ghi nhận đạt nhưng{" "}
          <strong>không cộng điểm</strong>.
        </p>
      </div>

      <p className="mt-6 text-xs text-faint">
        Streak (chuỗi ngày học liên tiếp) không cộng điểm trực tiếp — đó là một chỉ số riêng, tính
        theo số ngày có hoạt động học liên tục.
      </p>
    </main>
  );
}
