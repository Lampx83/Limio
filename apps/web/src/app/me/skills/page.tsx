import Link from "next/link";
import { redirect } from "next/navigation";
import { getLearnerSkillStates } from "@feedbackme/core-feedback";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SkillsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/me/skills");

  const skills = await getLearnerSkillStates(session.user.id, undefined);

  const masteredCount = skills.filter((s) => s.masteryProbability >= 0.9).length;
  const weakCount = skills.filter(
    (s) => s.isWeak && s.masteryProbability < 0.9,
  ).length;
  const learningCount = skills.length - masteredCount - weakCount;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
      <div>
        <span className="chip-brand">Skill profile</span>
        <h1 className="mt-3 h-display text-3xl font-bold sm:text-4xl">
          Bản đồ năng lực của bạn
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Mỗi câu hỏi bạn trả lời sẽ cập nhật mastery cho các skill liên quan
          (Bayesian Knowledge Tracing). Skill yếu được tô đỏ — nên ưu tiên ôn lại.
        </p>
      </div>

      {/* Summary */}
      {skills.length > 0 && (
        <div className="mt-6 grid grid-cols-3 gap-3 sm:gap-4">
          <SummaryCard
            label="Đã master"
            value={masteredCount}
            tone="accent"
            icon=""
          />
          <SummaryCard
            label="Đang học"
            value={learningCount}
            tone="brand"
            icon=""
          />
          <SummaryCard
            label="Cần ôn"
            value={weakCount}
            tone="danger"
            icon=""
          />
        </div>
      )}

      {skills.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-token p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-2xl">
                      </div>
          <p className="mt-4 text-muted">
            Chưa có dữ liệu skill nào. Làm vài quiz trong{" "}
            <Link href="/catalog" className="link">
              catalog
            </Link>{" "}
            để bắt đầu xây dựng skill profile.
          </p>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {skills.map((s) => {
            const masteryPct = Math.round(s.masteryProbability * 100);
            const isMastered = s.masteryProbability >= 0.9;
            const tone = isMastered ? "mastered" : s.isWeak ? "weak" : "learning";

            const toneStyle = {
              mastered:
                "border-accent-200 bg-gradient-to-br from-accent-50 to-transparent",
              weak: "border-danger-100 bg-gradient-to-br from-danger-50 to-transparent",
              learning: "border-token",
            }[tone];

            const barColor = {
              mastered: "bg-gradient-to-r from-accent-400 to-accent-600",
              weak: "bg-gradient-to-r from-danger-500 to-danger-600",
              learning: "bg-gradient-to-r from-brand-500 to-brand-700",
            }[tone];

            return (
              <li
                key={s.skillId}
                className={`card ${toneStyle} transition-shadow hover:shadow-card-hover`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {isMastered && <span className="text-lg"></span>}
                      <p className="truncate text-base font-semibold">{s.skillName}</p>
                    </div>
                    <p className="mt-0.5 font-mono text-xs text-faint">
                      {s.skillCode}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="h-display text-xl font-bold tabular-nums">
                      {masteryPct}
                      <span className="text-sm text-muted">%</span>
                    </p>
                    <p className="text-xs text-faint">
                      {s.correctCount}/{s.attempts} đúng
                    </p>
                  </div>
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-[rgb(var(--surface-muted))]">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${barColor}`}
                    style={{ width: `${masteryPct}%` }}
                  />
                </div>

                {isMastered && (
                  <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-accent-700">
                    <span></span>
                    Đã master — bạn đã được trao badge Skill Master.
                  </p>
                )}
                {!isMastered && s.isWeak && (
                  <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-danger-600">
                    <span></span>
                    Skill yếu — mastery dưới 50% sau ≥2 câu. Nên ôn lại.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function SummaryCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: "brand" | "accent" | "danger";
  icon: string;
}) {
  const toneClass = {
    brand: "text-brand-600",
    accent: "text-accent-600",
    danger: "text-danger-600",
  }[tone];
  return (
    <div className="card">
      <div className="flex items-baseline justify-between">
        <span className="text-xl">{icon}</span>
        <span className={`h-display text-2xl font-bold tabular-nums ${toneClass}`}>
          {value}
        </span>
      </div>
      <div className="mt-1 text-xs text-muted sm:text-sm">{label}</div>
    </div>
  );
}
