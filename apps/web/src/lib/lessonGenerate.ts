import type {
  LessonDraftResult,
  LessonOutline,
  LessonWritingMode,
  OutlineSection,
  SectionDraft,
  SourcePara,
} from "@feedbackme/shared-types";
import { fallbackSection, missingParas, renderLesson, renderSection } from "./lessonRender";

/**
 * Điều phối bước 3 "AI viết bài từ dàn ý đã chốt": mỗi mục một lần gọi (chạy
 * song song có giới hạn), mục lỗi thì dùng nguyên đoạn tài liệu (T5), rồi
 * Tổng kết cho từng bài, dựng HTML, đối chiếu tài liệu (T6). Không đụng DB, không
 * biết mô hình nào — hai hàm viết được truyền vào (route dùng AI thật, test dùng giả).
 */

export interface GenerateDeps {
  writeSection(input: { lessonTitle: string; section: OutlineSection; paras: SourcePara[]; writing: LessonWritingMode }): Promise<SectionDraft>;
  writeSummary(input: { lessonTitle: string; sectionTexts: Array<{ title: string; text: string }> }): Promise<string[]>;
  /** Lỗi nào phải dừng cả lượt (hết hạn mức AI…) thay vì dùng bản dự phòng. */
  isFatal?(e: unknown): boolean;
}

export interface GenerateInput {
  outline: LessonOutline;
  paras: SourcePara[];
  writing: LessonWritingMode;
  addObjectivesSummary: boolean;
}

export type GenerateProgress = { done: number; total: number; label: string; ok: boolean };

/** Số bước để vẽ thanh tiến độ: mỗi mục một bước, mỗi bài thêm một bước Tổng kết nếu bật. */
export function generationSteps(input: GenerateInput): number {
  const sections = input.outline.lessons.reduce((n, l) => n + l.sections.length, 0);
  return sections + (input.addObjectivesSummary ? input.outline.lessons.length : 0);
}

async function pool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!, i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return out;
}

function plain(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export async function generateLessons(
  input: GenerateInput,
  deps: GenerateDeps,
  onProgress?: (p: GenerateProgress) => void,
  concurrency = 3,
): Promise<LessonDraftResult> {
  const total = generationSteps(input);
  let done = 0;
  const tick = (label: string, ok: boolean) => onProgress?.({ done: ++done, total, label, ok });
  const fallbackSections: string[] = [];
  const missing: number[] = [];
  const lessons: LessonDraftResult["lessons"] = [];

  for (const lesson of input.outline.lessons) {
    const sectionsHtml = await pool(lesson.sections, concurrency, async (section) => {
      try {
        const d = await deps.writeSection({ lessonTitle: lesson.title, section, paras: input.paras, writing: input.writing });
        tick(section.title, true);
        return renderSection(section, d, input.paras);
      } catch (e) {
        if (deps.isFatal?.(e)) throw e;
        fallbackSections.push(section.title);
        tick(section.title, false);
        return fallbackSection(section, input.paras);
      }
    });

    let os: { objectives: string[]; summary: string[] } | null = null;
    if (input.addObjectivesSummary) {
      let summary: string[];
      try {
        summary = await deps.writeSummary({
          lessonTitle: lesson.title,
          sectionTexts: lesson.sections.map((s, i) => ({ title: s.title, text: plain(sectionsHtml[i] ?? "") })),
        });
        tick("Tổng kết", true);
      } catch (e) {
        if (deps.isFatal?.(e)) throw e;
        // Dự phòng: ý chính đầu tiên của mỗi mục (giảng viên đã duyệt ở dàn ý).
        summary = lesson.sections.map((s) => s.points[0]).filter((x): x is string => !!x).slice(0, 5);
        tick("Tổng kết", false);
      }
      os = { objectives: lesson.objectives.filter((o) => o.trim()), summary };
    }

    const html = renderLesson({ lesson, sectionsHtml, objectivesAndSummary: os });
    lessons.push({ title: lesson.title, html });
    if (input.writing === "keep") {
      missing.push(...missingParas(input.paras, lesson.sections.flatMap((s) => s.paras), html));
    }
  }

  return {
    lessons,
    fallbackSections,
    missingParas: missing.sort((a, b) => a - b),
    writing: input.writing,
    generatedAt: new Date().toISOString(),
  };
}
