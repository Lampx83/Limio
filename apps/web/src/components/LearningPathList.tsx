import type { PathStep, PathSurface } from "@feedbackme/core-feedback";
import MasteryBadge from "@/components/MasteryBadge";
import PathStepLink from "@/components/PathStepLink";

const REASON: Record<PathStep["kind"], string> = {
  review: "Ôn lại trước khi học tiếp",
  next: "Bài tiếp theo",
  practice: "Luyện thêm cho chắc",
  skim: "Có thể lướt qua",
};

/** B4 — danh sách bước lộ trình; dùng chung cho trang khoá và trang kết quả quiz. */
export default function LearningPathList({
  steps,
  courseSlug,
  surface,
}: {
  steps: PathStep[];
  courseSlug: string;
  surface: PathSurface;
}) {
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => (
        <li key={`${s.kind}:${s.lessonId}`}>
          <PathStepLink
            lessonId={s.lessonId}
            kind={s.kind}
            surface={surface}
            href={`/learn/${courseSlug}/lessons/${s.lessonId}`}
            className="flex items-start gap-3 rounded-xl border border-token bg-[rgb(var(--surface))] p-3 transition-colors hover:bg-[rgb(var(--surface-muted))]"
          >
            <span
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-700"
              aria-hidden
            >
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-meta block">{REASON[s.kind]}</span>
              <span className="block break-words text-sm font-semibold">{s.lessonTitle}</span>
              <span className="text-caption block truncate text-faint">{s.moduleTitle}</span>
            </span>
            {s.label !== "no_data" && <MasteryBadge label={s.label} className="shrink-0" />}
          </PathStepLink>
        </li>
      ))}
    </ol>
  );
}
