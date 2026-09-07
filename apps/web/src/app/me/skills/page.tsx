import Link from "next/link";
import { redirect } from "next/navigation";
import { getLearnerSkillStates, type SkillStateView } from "@feedbackme/core-feedback";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const UNGROUPED = "__ungrouped__";

interface TopicGroup {
  key: string;
  courseTitle: string | null;
  courseSlug: string | null;
  moduleTitle: string | null;
  topics: SkillStateView[];
}

/**
 * Group tags by course → chapter so a 40-lesson course reads as a handful of
 * sections instead of one endless list (B1.5 AC-4.5).
 */
function groupTopics(topics: SkillStateView[]): TopicGroup[] {
  const groups = new Map<string, TopicGroup>();
  for (const t of topics) {
    const key = t.group ? `${t.group.courseId}::${t.group.moduleTitle}` : UNGROUPED;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        courseTitle: t.group?.courseTitle ?? null,
        courseSlug: t.group?.courseSlug ?? null,
        moduleTitle: t.group?.moduleTitle ?? null,
        topics: [],
      };
      groups.set(key, group);
    }
    group.topics.push(t);
  }
  // Ungrouped tags last — they're the exception, not the headline.
  return [...groups.values()].sort((a, b) => {
    if (a.key === UNGROUPED) return 1;
    if (b.key === UNGROUPED) return -1;
    return (a.courseTitle ?? "").localeCompare(b.courseTitle ?? "", "vi");
  });
}

export default async function SkillsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/me/skills");

  const topics = await getLearnerSkillStates(session.user.id, undefined);

  const masteredCount = topics.filter((s) => s.masteryProbability >= 0.9).length;
  const weakCount = topics.filter(
    (s) => s.isWeak && s.masteryProbability < 0.9,
  ).length;
  const learningCount = topics.length - masteredCount - weakCount;
  const groups = groupTopics(topics);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
      <div>
        <span className="chip-brand">Hồ sơ học tập</span>
        <h1 className="mt-3 h-display text-3xl font-bold sm:text-4xl">
          Bản đồ chủ đề của bạn
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Mỗi câu hỏi bạn trả lời sẽ cập nhật mức nắm vững của chủ đề liên quan.
          Chủ đề yếu được tô đỏ — nên ưu tiên ôn lại.
        </p>
      </div>

      {/* Summary */}
      {topics.length > 0 && (
        <div className="mt-6 grid grid-cols-3 gap-3 sm:gap-4">
          <SummaryCard label="Đã nắm vững" value={masteredCount} tone="accent" icon="" />
          <SummaryCard label="Đang học" value={learningCount} tone="brand" icon="" />
          <SummaryCard label="Cần ôn" value={weakCount} tone="danger" icon="" />
        </div>
      )}

      {topics.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-token p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-2xl">
                      </div>
          <p className="mt-4 text-muted">
            Chưa có dữ liệu chủ đề nào. Làm vài quiz trong{" "}
            <Link href="/catalog" className="link">
              catalog
            </Link>{" "}
            để bắt đầu xây dựng bản đồ chủ đề.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {groups.map((group) => (
            <section key={group.key}>
              <header className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                {group.moduleTitle ? (
                  <>
                    <h2 className="text-base font-semibold">{group.moduleTitle}</h2>
                    {group.courseSlug && group.courseTitle && (
                      <Link
                        href={`/learn/${group.courseSlug}`}
                        className="link text-sm"
                        prefetch={false}
                      >
                        {group.courseTitle}
                      </Link>
                    )}
                  </>
                ) : (
                  <h2 className="text-base font-semibold">Chủ đề khác</h2>
                )}
                <span className="text-meta text-faint">
                  · {group.topics.length} chủ đề
                </span>
              </header>

              <ul className="mt-3 space-y-3">
                {group.topics.map((s) => (
                  <TopicCard key={s.skillId} topic={s} courseSlug={group.courseSlug} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

function TopicCard({
  topic: s,
  courseSlug,
}: {
  topic: SkillStateView;
  courseSlug: string | null;
}) {
  const masteryPct = Math.round(s.masteryProbability * 100);
  const isMastered = s.masteryProbability >= 0.9;
  const tone = isMastered ? "mastered" : s.isWeak ? "weak" : "learning";

  const toneStyle = {
    mastered: "border-accent-200 bg-gradient-to-br from-accent-50 to-transparent",
    weak: "border-danger-100 bg-gradient-to-br from-danger-50 to-transparent",
    learning: "border-token",
  }[tone];

  const barColor = {
    mastered: "bg-gradient-to-r from-accent-400 to-accent-600",
    weak: "bg-gradient-to-r from-danger-500 to-danger-600",
    learning: "bg-gradient-to-r from-brand-500 to-brand-700",
  }[tone];

  const lessonHref =
    courseSlug && s.group ? `/learn/${courseSlug}/lessons/${s.group.lessonId}` : null;

  return (
    <li className={`card ${toneStyle} transition-shadow hover:shadow-card-hover`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {isMastered && <span className="text-lg"></span>}
            <p className="truncate text-base font-semibold">{s.skillName}</p>
          </div>
          {/* An auto tag's code is just the lesson id — noise for the learner. */}
          {!s.isAuto && (
            <p className="mt-0.5 font-mono text-xs text-faint">{s.skillCode}</p>
          )}
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
          Đã nắm vững — bạn đã được trao badge cho chủ đề này.
        </p>
      )}
      {!isMastered && s.isWeak && (
        <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs font-medium text-danger-600">
          <span></span>
          Cần ôn — dưới 50% sau ≥2 câu.
          {lessonHref && (
            <Link href={lessonHref} className="link font-semibold">
              Mở bài học →
            </Link>
          )}
        </p>
      )}
    </li>
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
