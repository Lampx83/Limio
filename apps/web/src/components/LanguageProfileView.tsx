import Link from "next/link";
import { Headphones, BookOpen, Mic, PenLine } from "lucide-react";
import {
  LANGUAGE_SKILL_LABEL,
  type LanguageSkill,
  type MasteryLabel,
} from "@feedbackme/shared-types";
import type {
  FlashcardStats,
  LanguageProfile,
  LanguageProfileReason,
  LanguageSuggestion,
} from "@feedbackme/core-feedback";
import StatusBadge, { type StatusTone } from "@/components/ui/StatusBadge";
import StickyMobileCTA from "@/components/ui/StickyMobileCTA";
import EmptyState from "@/components/ui/EmptyState";
import FlashcardStatsBlock from "@/components/FlashcardStatsBlock";
import { reviewableToday } from "@/lib/flashcardSession";
import {
  RADAR_CENTER,
  RADAR_RADIUS,
  languageLabelText,
  radarAltText,
  radarPoint,
  ringPoint,
} from "@/lib/languageRadar";

/**
 * LANG G3 — trang "Hồ sơ 4 kỹ năng" của học viên. Server component: không có state,
 * và nhờ vậy props KHÔNG bị serialize xuống trình duyệt.
 *
 * Mọi thứ hiển thị theo NHÃN. Không có phần trăm, không có xác suất — và hình dạng
 * dữ liệu vào đây (LanguageProfile cho audience "learner") cũng không chứa chúng.
 */

const TONE: Record<MasteryLabel, StatusTone> = {
  no_data: "neutral",
  needs_review: "warning", // vàng chứ không đỏ: lời nhắc việc nên làm, không phải lỗi
  practice_more: "info",
  solid: "success",
};

const ICON: Record<LanguageSkill, typeof Headphones> = {
  listening: Headphones,
  speaking: Mic,
  reading: BookOpen,
  writing: PenLine,
};

const LEVEL_NOTE: Record<MasteryLabel, string> = {
  needs_review: "Nên ôn lại các bài này trước.",
  practice_more: "Gần vững rồi — luyện thêm vài bài.",
  solid: "Bạn đang làm tốt phần này.",
  no_data: "Làm thêm vài bài để có đánh giá.",
};

// Lời lẽ trung tính: học viên lớp đối chứng nhận câu giống hệt khoá chưa bật tính năng.
const UNAVAILABLE: Record<LanguageProfileReason, string> = {
  control_variant: "Hồ sơ kỹ năng chưa khả dụng cho khoá học này.",
  personalization_off: "Hồ sơ kỹ năng chưa khả dụng cho khoá học này.",
  language_mode_off: "Hồ sơ kỹ năng chưa khả dụng cho khoá học này.",
  not_enrolled: "Bạn cần ghi danh khoá học để xem hồ sơ kỹ năng.",
  course_not_found: "Không tìm thấy khoá học.",
};

function reasonText(s: LanguageSuggestion): string {
  const name = LANGUAGE_SKILL_LABEL[s.skill];
  if (s.reason === "review") return `Kỹ năng ${name} đang cần ôn nhất.`;
  if (s.reason === "practice") return `Kỹ năng ${name} cần luyện thêm một chút.`;
  return `Bắt đầu với kỹ năng ${name}.`;
}

function Radar({ skills }: { skills: LanguageProfile["skills"] }) {
  const pts = skills.map((r, i) => ({ r, p: radarPoint(i, r.label) }));
  const ring = (f: number) =>
    [0, 1, 2, 3].map((i) => ringPoint(i, f)).map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(" ");
  return (
    <svg
      viewBox="0 0 220 220"
      role="img"
      aria-label={radarAltText(skills)}
      className="mx-auto h-auto w-full max-w-[280px]"
    >
      <polygon points={ring(1 / 3)} fill="none" className="stroke-gray-200" strokeWidth="0.75" />
      <polygon points={ring(2 / 3)} fill="none" className="stroke-gray-200" strokeWidth="0.75" />
      <polygon points={ring(1)} fill="none" className="stroke-gray-300" strokeWidth="0.75" />
      <line x1={RADAR_CENTER} y1={RADAR_CENTER - RADAR_RADIUS} x2={RADAR_CENTER} y2={RADAR_CENTER + RADAR_RADIUS} className="stroke-gray-200" strokeWidth="0.75" />
      <line x1={RADAR_CENTER - RADAR_RADIUS} y1={RADAR_CENTER} x2={RADAR_CENTER + RADAR_RADIUS} y2={RADAR_CENTER} className="stroke-gray-200" strokeWidth="0.75" />
      <polygon
        points={pts.map(({ p }) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
        className="fill-brand-200/50 stroke-brand-600"
        strokeWidth="1.25"
      />
      {pts.map(({ r, p }) => (
        <circle
          key={r.skill}
          data-state={r.label}
          cx={p.x}
          cy={p.y}
          r={4.5}
          strokeWidth={1.5}
          strokeDasharray={p.hollow ? "2 2" : undefined}
          className={p.hollow ? "fill-white stroke-gray-400" : "fill-brand-600 stroke-white"}
        />
      ))}
      {skills.map((r, i) => {
        const a = ringPoint(i, 1.28);
        const anchor = i === 1 ? "start" : i === 3 ? "end" : "middle";
        return (
          <text key={r.skill} x={a.x} y={a.y + 4} textAnchor={anchor} fontSize="13" className="fill-[rgb(var(--text))]">
            {LANGUAGE_SKILL_LABEL[r.skill]}
          </text>
        );
      })}
    </svg>
  );
}

export default function LanguageProfileView({
  slug,
  profile,
  flashcards,
}: {
  slug: string;
  profile: LanguageProfile;
  /** Thống kê flashcard (G4); thiếu hoặc khoá không có thẻ thì không hiện khối Từ vựng. */
  flashcards?: FlashcardStats;
}) {
  if (!profile.enabled) {
    return (
      <EmptyState
        title="Hồ sơ kỹ năng"
        description={UNAVAILABLE[profile.reason ?? "language_mode_off"]}
      />
    );
  }

  const assigned = profile.skills.some((s) => s.lessonsTotal > 0);
  if (!assigned) {
    return (
      <EmptyState
        title="Hồ sơ 4 kỹ năng"
        description="Giảng viên chưa gán kỹ năng nghe, nói, đọc, viết cho bài học nào trong khoá này nên chưa có hồ sơ để hiển thị. Bạn có thể nhắn giảng viên để được hỗ trợ."
      />
    );
  }

  const s = profile.suggestion;
  const href = s ? `/learn/${slug}/lessons/${s.lessonId}` : null;
  const cardsToReview = flashcards ? reviewableToday(flashcards) : 0;
  const cardsHref = `/learn/${slug}/flashcards`;
  const showToday = !!(s && href) || cardsToReview > 0;
  const ctaHref = href ?? (cardsToReview > 0 ? cardsHref : null);

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-token bg-[rgb(var(--surface))] p-4" aria-labelledby="lp-radar">
          <h2 id="lp-radar" className="text-h4">Hồ sơ 4 kỹ năng</h2>
          <p className="text-meta mt-1">Ba vòng từ trong ra ngoài: Cần ôn, Nên luyện thêm, Vững.</p>
          <div className="mt-3">
            <Radar skills={profile.skills} />
          </div>
        </section>

        {showToday && (
          <section className="rounded-xl border-2 border-brand-200 bg-[rgb(var(--surface))] p-4" aria-labelledby="lp-today">
            <h2 id="lp-today" className="text-h4">Luyện hôm nay</h2>
            {s && href && (
              <>
                <p className="mt-2 text-body font-medium">{s.lessonTitle}</p>
                <p className="text-meta mt-1">{reasonText(s)}</p>
                <Link href={href} className="btn-primary mt-4 hidden lg:inline-flex">
                  Bắt đầu luyện
                </Link>
              </>
            )}
            {cardsToReview > 0 && (
              <div className={s ? "mt-4 border-t border-token pt-4" : "mt-2"}>
                <p className="text-body font-medium">{`Ôn ${cardsToReview} thẻ từ vựng`}</p>
                <p className="text-meta mt-1">Giữ những từ đã học khỏi quên.</p>
                <Link href={cardsHref} className="btn-secondary mt-3 hidden lg:inline-flex">
                  Ôn thẻ
                </Link>
              </div>
            )}
          </section>
        )}
      </div>

      {flashcards && <FlashcardStatsBlock slug={slug} stats={flashcards} />}

      <ul className="grid gap-3 sm:grid-cols-2">
        {profile.skills.map((r) => {
          const Icon = ICON[r.skill];
          return (
            <li key={r.skill} className="rounded-xl border border-token bg-[rgb(var(--surface))] p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-body font-medium">
                  <Icon size={18} aria-hidden />
                  {LANGUAGE_SKILL_LABEL[r.skill]}
                </p>
                <StatusBadge tone={TONE[r.label]} dot={false}>
                  {languageLabelText(r.label)}
                </StatusBadge>
              </div>
              <p className="text-meta mt-2">
                {r.lessonsTotal === 0 ? "Khoá chưa có bài thuộc kỹ năng này." : LEVEL_NOTE[r.label]}
              </p>
              {r.lessonsTotal > 0 && (
                <p className="text-caption mt-1">{`${r.lessonsPracticed}/${r.lessonsTotal} bài đã làm`}</p>
              )}
            </li>
          );
        })}
      </ul>

      {ctaHref && (
        <StickyMobileCTA
          primary="Luyện hôm nay"
          secondary={s ? s.lessonTitle : `Ôn ${cardsToReview} thẻ từ vựng`}
          action={
            <Link href={ctaHref} className="btn-primary">
              Bắt đầu
            </Link>
          }
        />
      )}
    </div>
  );
}
