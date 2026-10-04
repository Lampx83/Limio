import { z } from "zod";

/**
 * LANG G5d — kết quả theo phần của đề thi thử. Hàm THUẦN, không đọc DB.
 *
 * Nguyên tắc: không bao giờ hiện điểm giả. Phần còn câu tự luận chờ chấm thì `score = null`
 * (chỉ biết số câu chờ); "ước lượng" chỉ có khi giảng viên tự nhập bảng quy đổi cho phần đó
 * (hệ thống không mang sẵn số liệu chính thức của HSK/IELTS/TOEIC) và luôn kèm nhãn
 * "ước lượng, không phải điểm chính thức" ở giao diện.
 */

export const SCORE_BANDS_MAX = 40;

export interface ScoreBand {
  from: number;
  to: number;
  label: string;
}

/** Bảng quy đổi điểm thô của MỘT phần → nhãn ước lượng (vd "150–200"). Rỗng = bỏ bảng. */
export const ScoreBandsInput = z
  .array(
    z.object({
      from: z.number().min(0),
      to: z.number().min(0),
      label: z.string().trim().min(1).max(40),
    }),
  )
  .max(SCORE_BANDS_MAX)
  .superRefine((bands, ctx) => {
    if (bands.some((b) => b.from > b.to)) {
      ctx.addIssue({ code: "custom", message: "from_greater_than_to" });
    }
    const sorted = [...bands].sort((a, b) => a.from - b.from);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i]!.from <= sorted[i - 1]!.to) {
        ctx.addIssue({ code: "custom", message: "bands_overlap" });
        break;
      }
    }
  });

export function lookupScoreBand(bands: ScoreBand[] | null | undefined, score: number): string | null {
  if (!bands) return null;
  return bands.find((b) => score >= b.from && score <= b.to)?.label ?? null;
}

export interface SectionResultInput {
  sections: {
    id: string;
    title: string;
    languageSkill: string | null;
    scoreBands: ScoreBand[] | null;
    questions: { id: string; points: number }[];
  }[];
  answers: {
    questionId: string;
    autoScore: number | null;
    manualScore: number | null;
    needsGrading: boolean;
  }[];
}

export interface SectionResult {
  sectionId: string;
  title: string;
  languageSkill: string | null;
  questionCount: number;
  /** Số câu có dòng đáp án (kể cả đáp án sai). */
  answeredCount: number;
  /** Số câu đạt TRỌN điểm (không tính câu chờ chấm). */
  correctCount: number;
  /** null khi còn câu chờ chấm. */
  score: number | null;
  maxScore: number;
  pending: boolean;
  pendingCount: number;
  /** Nhãn ước lượng theo bảng của giảng viên; null nếu không có bảng hoặc đang chờ chấm. */
  estimate: string | null;
}

const EPS = 1e-9;

export function computeSectionResults(input: SectionResultInput): SectionResult[] {
  const byQuestion = new Map(input.answers.map((a) => [a.questionId, a]));
  return input.sections.map((s) => {
    let score = 0;
    let maxScore = 0;
    let correct = 0;
    let answered = 0;
    let pendingCount = 0;
    for (const q of s.questions) {
      maxScore += q.points;
      const a = byQuestion.get(q.id);
      if (!a) continue; // bỏ trống: 0 điểm
      answered++;
      if (a.needsGrading) {
        pendingCount++;
        continue;
      }
      const got = a.manualScore ?? a.autoScore ?? 0;
      score += got;
      if (q.points > 0 && got >= q.points - EPS) correct++;
    }
    const pending = pendingCount > 0;
    return {
      sectionId: s.id,
      title: s.title,
      languageSkill: s.languageSkill,
      questionCount: s.questions.length,
      answeredCount: answered,
      correctCount: correct,
      score: pending ? null : score,
      maxScore,
      pending,
      pendingCount,
      estimate: pending ? null : lookupScoreBand(s.scoreBands, score),
    };
  });
}

export type SectionTrend = "up" | "down" | "same" | null;

/** So từng phần với lượt trước theo TỈ LỆ điểm; null khi không so được (không bịa). */
export function compareSectionResults(
  current: SectionResult[],
  previous: SectionResult[] | null,
): Record<string, SectionTrend> {
  const prevById = new Map((previous ?? []).map((p) => [p.sectionId, p]));
  const out: Record<string, SectionTrend> = {};
  for (const c of current) {
    const p = prevById.get(c.sectionId);
    if (!p || c.score === null || p.score === null || c.maxScore <= 0 || p.maxScore <= 0) {
      out[c.sectionId] = null;
      continue;
    }
    const diff = c.score / c.maxScore - p.score / p.maxScore;
    out[c.sectionId] = Math.abs(diff) < EPS ? "same" : diff > 0 ? "up" : "down";
  }
  return out;
}
