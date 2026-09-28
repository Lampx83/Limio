import Link from "next/link";
import { redirect } from "next/navigation";
import { getLearnerSkillStates, type SkillStateView } from "@feedbackme/core-feedback";
import { MASTERY_LABEL_TEXT, masteryLabel } from "@feedbackme/shared-types";
import { auth } from "@/lib/auth";
import MasteryBadge from "@/components/MasteryBadge";

/** Ngưỡng trao huy hiệu kỹ năng — khác nhãn "Vững" (85%) có chủ ý: huy hiệu là phần thưởng. */
const BADGE_AT = 0.9;

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

  const countOf = (label: ReturnType<typeof masteryLabel>) =>
    topics.filter((s) => masteryLabel(s.masteryProbability) === label).length;
  const solidCount = countOf("solid");
  const practiceCount = countOf("practice_more");
  const reviewCount = countOf("needs_review");
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
          Chủ đề “Cần ôn” nên được ưu tiên ôn lại.
        </p>
      </div>

      {/* Summary */}
      {topics.length > 0 && (
        <div className="mt-6 grid grid-cols-3 gap-3 sm:gap-4">
          <SummaryCard label={MASTERY_LABEL_TEXT.solid} value={solidCount} tone="accent" icon="" />
          <SummaryCard label={MASTERY_LABEL_TEXT.practice_more} value={practiceCount} tone="brand" icon="" />
          <SummaryCard label={MASTERY_LABEL_TEXT.needs_review} value={reviewCount} tone="danger" icon="" />
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
  const label = masteryLabel(s.masteryProbability);
  const hasBadge = s.masteryProbability >= BADGE_AT;

  const toneStyle = {
    solid: "border-accent-200 bg-gradient-to-br from-accent-50 to-transparent",
    needs_review: "border-yellow-200 bg-gradient-to-br from-yellow-50 to-transparent",
    practice_more: "border-token",
    no_data: "border-token",
  }[label];

  const lessonHref =
    courseSlug && s.group ? `/learn/${courseSlug}/lessons/${s.group.lessonId}` : null;

  return (
    <li className={`card ${toneStyle} transition-shadow hover:shadow-card-hover`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{s.skillName}</p>
          {/* An auto tag's code is just the lesson id — noise for the learner. */}
          {!s.isAuto && (
            <p className="mt-0.5 font-mono text-xs text-faint">{s.skillCode}</p>
          )}
          <p className="mt-0.5 text-xs text-faint">
            {s.correctCount}/{s.attempts} câu đúng
          </p>
        </div>
        <MasteryBadge label={label} className="shrink-0" />
      </div>

      {hasBadge && (
        <p className="mt-3 text-xs font-medium text-accent-700">
          Bạn đã được trao huy hiệu cho chủ đề này.
        </p>
      )}
      {label === "needs_review" && lessonHref && (
        <p className="mt-3 text-xs">
          <Link href={lessonHref} className="link font-semibold">
            Ôn lại bài học →
          </Link>
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
