import type OpenAI from "openai";
import { prisma, type PrismaClient } from "@feedbackme/db";
import {
  LESSON_BOX_LABELS,
  LESSON_LAYOUT_LABELS,
  OUTLINE_BOX_KINDS,
  type LessonWritingMode,
  type OutlineSection,
  type SectionDraft,
  type SourcePara,
} from "@feedbackme/shared-types";
import { DEFAULT_MODEL, assertWithinCaps, recordAiUsage } from "./aiTutor";
import { AiGenerationError, callJsonModel } from "./generators";

/**
 * Bước 3 của "tạo bài học từ tài liệu": AI viết từng MỤC theo dàn ý giảng viên
 * đã chốt, từ đúng các đoạn tài liệu thuộc mục đó. Đầu ra là JSON có cấu trúc
 * (SectionDraft) — máy chủ tự dựng HTML, nên AI không thể làm vỡ khối hay chèn
 * mã. Mỗi mục một lần gọi để một mục lỗi không kéo cả bài (T5).
 */

const SECTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    intro: { type: "array", items: { type: "string" } },
    parts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          paragraphs: { type: "array", items: { type: "string" } },
          bullets: { type: "array", items: { type: "string" } },
        },
        required: ["title", "paragraphs", "bullets"],
      },
    },
    boxes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          kind: { type: "string", enum: [...OUTLINE_BOX_KINDS] },
          title: { type: "string" },
          paragraphs: { type: "array", items: { type: "string" } },
        },
        required: ["kind", "title", "paragraphs"],
      },
    },
    imageCaption: { type: "string" },
  },
  required: ["intro", "parts", "boxes", "imageCaption"],
};

const WRITING_RULES: Record<LessonWritingMode, string> = {
  keep: `Cách viết: GIỮ NGUYÊN LỜI của tài liệu.
- Giữ nguyên câu chữ của tài liệu, từng câu. Chỉ được: sửa lỗi chính tả và dấu câu rõ ràng; chia hoặc gộp đoạn; chuyển câu vào phần, hộp phù hợp; đặt tiêu đề cho phần.
- Không viết thêm câu mới, không tóm tắt, không lược bỏ câu nào có nội dung.`,
  edit: `Cách viết: BIÊN TẬP CHO MẠCH LẠC.
- Được viết lại câu lủng củng hoặc dài dòng, thêm câu dẫn và câu chuyển ý ngắn, lược phần lặp lại.
- Không đổi ý nghĩa, số liệu, thuật ngữ, tên riêng, trích dẫn; không bỏ ý quan trọng.`,
};

const LAYOUT_RULES = `Bố cục của mục quyết định cách dùng "parts":
- text: chủ yếu là intro; chỉ dùng parts (mỗi phần có tiêu đề nhỏ) khi mục có các ý con rõ rệt.
- image: như text; viết imageCaption ngắn mô tả ảnh của mục, kèm nguồn nếu tài liệu có ghi.
- cards: 2 đến 4 phần song song; tiêu đề phần là tên khái niệm (ngắn), nội dung 1–2 câu.
- compare: đúng 2 phần là hai phương án được đối chiếu.
- steps: mỗi phần là một bước theo đúng thứ tự; tiêu đề phần là tên bước, không đánh số.
- faq: tiêu đề phần là câu hỏi (kết thúc bằng dấu ?), nội dung là câu trả lời.
- stats: tiêu đề phần là một con số CÓ TRONG TÀI LIỆU (kèm đơn vị), nội dung là chú thích; không có số thì dùng intro.`;

const SECTION_SYSTEM = (mode: LessonWritingMode) => `Bạn là biên tập viên học liệu đại học. Viết MỘT mục của bài học trên hệ thống học trực tuyến, từ các đoạn tài liệu được đưa, theo dàn ý giảng viên đã chốt.

${WRITING_RULES[mode]}

Quy tắc chung:
- Chỉ dùng nội dung của các đoạn tài liệu được đưa. Không thêm kiến thức, số liệu, ví dụ hay khẳng định không có trong đó.
- Văn phong khoa học, câu đầy đủ chủ ngữ và vị ngữ, không viết cụt, không emoji. Không viết lại tiêu đề mục (hệ thống tự đặt).
- Chữ thường, không HTML, không Markdown, trừ **đậm** cho thuật ngữ then chốt và *nghiêng* khi cần.
- Mỗi đoạn trong mảng là một đoạn văn. bullets dùng khi tài liệu liệt kê; không thì để mảng rỗng.
- boxes: chỉ dùng các loại hộp dàn ý yêu cầu, lấy nội dung từ đoạn tài liệu tương ứng (lưu ý, ví dụ, định nghĩa); title để chuỗi rỗng nếu tên mặc định đã phù hợp. Không có nội dung phù hợp thì bỏ hộp đó.

${LAYOUT_RULES}

Trả JSON đúng lược đồ: { intro, parts: [{ title, paragraphs, bullets }], boxes: [{ kind, title, paragraphs }], imageCaption }.`;

export interface WriteSectionInput {
  lessonTitle: string;
  section: OutlineSection;
  /** Toàn bộ tài liệu; chỉ các đoạn section.paras được đưa cho mô hình. */
  paras: SourcePara[];
  writing: LessonWritingMode;
}

export function buildSectionPrompt(input: WriteSectionInput): string {
  const s = input.section;
  const lines = s.paras.map((n) => {
    const p = input.paras[n];
    if (!p) return "";
    return "t" in p ? `[${n + 1}] ${p.t}` : `[${n + 1}] [ẢNH${p.alt ? `: ${p.alt}` : ""}]`;
  });
  return `Bài học: ${input.lessonTitle}
Mục: ${s.title}
Bố cục: ${s.layout} (${LESSON_LAYOUT_LABELS[s.layout]})
Ý chính giảng viên đã chốt:
${s.points.length ? s.points.map((p) => `- ${p}`).join("\n") : "- (không ghi)"}
Hộp cần có: ${s.boxes.length ? s.boxes.map((b) => `${b} (${LESSON_BOX_LABELS[b]})`).join(", ") : "không"}

Các đoạn tài liệu của mục:
${lines.filter(Boolean).join("\n") || "(mục này không có đoạn tài liệu — viết ngắn gọn từ ý chính, không thêm kiến thức mới)"}

Viết mục này. Trả JSON.`;
}

function asStrings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim()) : [];
}

/** Đầu ra mô hình → SectionDraft sạch (bỏ phần rỗng, hộp lạ). */
export function cleanSectionDraft(raw: unknown): SectionDraft {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const parts = Array.isArray(o.parts) ? o.parts : [];
  const boxes = Array.isArray(o.boxes) ? o.boxes : [];
  return {
    intro: asStrings(o.intro),
    parts: parts
      .map((p) => (p && typeof p === "object" ? (p as Record<string, unknown>) : {}))
      .map((p) => ({
        title: typeof p.title === "string" ? p.title.trim() : "",
        paragraphs: asStrings(p.paragraphs),
        bullets: asStrings(p.bullets),
      }))
      .filter((p) => p.title || p.paragraphs.length || p.bullets.length),
    boxes: boxes
      .map((b) => (b && typeof b === "object" ? (b as Record<string, unknown>) : {}))
      .filter((b) => (OUTLINE_BOX_KINDS as readonly unknown[]).includes(b.kind))
      .map((b) => ({
        kind: b.kind as SectionDraft["boxes"][number]["kind"],
        title: typeof b.title === "string" ? b.title.trim() : "",
        paragraphs: asStrings(b.paragraphs),
      }))
      .filter((b) => b.paragraphs.length),
    imageCaption: typeof o.imageCaption === "string" ? o.imageCaption.trim() : "",
  };
}

export async function writeLessonSection(
  userId: string,
  input: WriteSectionInput,
  openai: OpenAI,
  model = DEFAULT_MODEL,
  db: PrismaClient = prisma,
): Promise<SectionDraft> {
  await assertWithinCaps(userId, db, "generator");
  const { data, inputTokens, outputTokens } = await callJsonModel<unknown>(
    openai,
    model,
    SECTION_SYSTEM(input.writing),
    buildSectionPrompt(input),
    "lesson_section",
    SECTION_SCHEMA,
    4000,
  );
  await recordAiUsage(userId, model, inputTokens, outputTokens, db);
  const draft = cleanSectionDraft(data);
  if (!draft.intro.length && !draft.parts.length) throw new AiGenerationError("openai_error", "empty_section");
  return draft;
}

const SUMMARY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: { points: { type: "array", items: { type: "string" } } },
  required: ["points"],
};

/** Tổng kết cuối bài: 3–5 ý rút từ chính các mục vừa viết (không đưa ý ngoài bài). */
export async function writeLessonSummary(
  userId: string,
  input: { lessonTitle: string; sectionTexts: Array<{ title: string; text: string }> },
  openai: OpenAI,
  model = DEFAULT_MODEL,
  db: PrismaClient = prisma,
): Promise<string[]> {
  await assertWithinCaps(userId, db, "generator");
  const body = input.sectionTexts.map((s) => `## ${s.title}\n${s.text.slice(0, 3000)}`).join("\n\n");
  const { data, inputTokens, outputTokens } = await callJsonModel<{ points?: unknown }>(
    openai,
    model,
    `Bạn là biên tập viên học liệu đại học. Viết phần Tổng kết cho bài học: 3 đến 5 ý, mỗi ý một câu đầy đủ, tóm các ý chính đã trình bày. Chỉ rút từ nội dung bài, không thêm kiến thức mới, không emoji, không HTML. Trả JSON { points }.`,
    `Bài học: ${input.lessonTitle}\n\n${body}\n\nViết Tổng kết. Trả JSON.`,
    "lesson_summary",
    SUMMARY_SCHEMA,
    800,
  );
  await recordAiUsage(userId, model, inputTokens, outputTokens, db);
  return asStrings(data?.points).slice(0, 5);
}
