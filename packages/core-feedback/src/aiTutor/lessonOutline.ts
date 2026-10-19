import type OpenAI from "openai";
import { prisma, type PrismaClient } from "@feedbackme/db";
import {
  OUTLINE_AUTO_LAYOUTS,
  OUTLINE_BOX_KINDS,
  OUTLINE_LIMITS,
  type LessonTemplateKey,
  type SourcePara,
} from "@feedbackme/shared-types";
import { DEFAULT_MODEL, assertWithinCaps, recordAiUsage } from "./aiTutor";
import { AiGenerationError, callJsonModel } from "./generators";

/**
 * Bước 2 của "tạo bài học từ tài liệu": đọc tài liệu (đã tách đoạn, đánh số)
 * và đề xuất DÀN Ý theo mẫu bài giảng viên chọn — tên bài, mục tiêu, các mục
 * kèm cách trình bày (AI tự chọn trong 4 loại), ý chính, hộp dự kiến và các
 * đoạn tài liệu thuộc mục. Chưa viết bài, nên rẻ; giảng viên sửa
 * và chốt dàn ý trước khi tốn token viết bài.
 *
 * Kết quả là đề xuất thô: kiểm bố cục, độ dài, đoạn trùng/lạc, số bài nằm ở
 * apps/web/src/lib/lessonOutline.ts (normalizeLessonOutline) — không tin thẳng
 * đầu ra mô hình.
 */

export const LESSON_OUTLINE_MIN_CHARS = 200;
/** Ngân sách chữ cho phần trích đoạn trong lời nhắc (≈ 15–18 nghìn token). */
const PREVIEW_BUDGET_CHARS = 48_000;
const PREVIEW_MAX_PER_PARA = 400;
const PREVIEW_MIN_PER_PARA = 60;

export interface RawOutlineSection {
  title: string;
  layout: string;
  points: string[];
  boxes: string[];
  /** Chỉ số đoạn, bắt đầu từ 0 (đã đổi từ số thứ tự 1.. trong lời nhắc). */
  paras: number[];
}

export interface RawOutlineLesson {
  title: string;
  objectives: string[];
  sections: RawOutlineSection[];
}

export interface RawLessonOutline {
  lessons: RawOutlineLesson[];
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    lessons: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          objectives: { type: "array", items: { type: "string" } },
          sections: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                title: { type: "string" },
                layout: { type: "string", enum: [...OUTLINE_AUTO_LAYOUTS] },
                points: { type: "array", items: { type: "string" } },
                boxes: { type: "array", items: { type: "string", enum: [...OUTLINE_BOX_KINDS] } },
                paras: { type: "array", items: { type: "integer" } },
              },
              required: ["title", "layout", "points", "boxes", "paras"],
            },
          },
        },
        required: ["title", "objectives", "sections"],
      },
    },
  },
  required: ["lessons"],
};

const TEMPLATE_RULES: Record<LessonTemplateKey, string> = {
  theory: `Mẫu bài: BÀI LÝ THUYẾT.
- Khung: các mục nội dung đi theo mạch của tài liệu (khoảng 2 đến ${OUTLINE_LIMITS.suggestSections} mục). Mục tiêu và Tổng kết do hệ thống tự thêm, KHÔNG tạo mục riêng cho chúng.`,
  practice: `Mẫu bài: BÀI HƯỚNG DẪN THỰC HÀNH.
- Khung, theo đúng thứ tự, chỉ giữ mục nào tài liệu có nội dung:
  1. "Chuẩn bị": dụng cụ, phần mềm, kiến thức hay điều kiện cần có trước khi làm.
  2. "Các bước thực hiện": quy trình theo thứ tự (có thể tách thành vài mục nếu quy trình dài, mỗi mục một giai đoạn).
  3. "Lỗi thường gặp": các lưu ý, sai sót và cách khắc phục.
- Nội dung lý thuyết cần thiết đặt ngắn gọn trong "Chuẩn bị". Mục tiêu và Tổng kết do hệ thống tự thêm, KHÔNG tạo mục riêng.`,
  review: `Mẫu bài: BÀI ÔN TẬP.
- Khung, theo đúng thứ tự:
  1. "Ý chính cần nhớ": các khái niệm, nguyên tắc cốt lõi của tài liệu (có thể tách thành vài mục theo chủ đề).
  2. "Câu hỏi thường gặp": những câu hỏi người học hay thắc mắc và câu trả lời, rút từ tài liệu.
  3. "Tự kiểm tra": vài câu hỏi để người học tự trả lời rồi đối chiếu, đáp án rút từ tài liệu.
- Mục tiêu học tập (objectives) được phép để rỗng nếu tài liệu không đủ cơ sở. Tổng kết do hệ thống tự thêm.`,
};

const SYSTEM = (template: LessonTemplateKey) => `Bạn là chuyên gia thiết kế học liệu đại học. Đọc tài liệu của giảng viên (đã chia thành các đoạn đánh số [1], [2]…) và đề xuất DÀN Ý cho bài học văn bản trên hệ thống học trực tuyến. Chỉ lập dàn ý, CHƯA viết bài.

Quy tắc nội dung:
- Bám sát tài liệu. Không thêm kiến thức, số liệu, ví dụ hay khẳng định không có trong tài liệu.
- Văn phong khoa học, câu đầy đủ chủ ngữ và vị ngữ, không viết cụt, không emoji. Giữ nguyên thuật ngữ, tên riêng, số liệu của tài liệu.

${TEMPLATE_RULES[template]}

Cấu trúc:
- Mỗi bài học có: title (tên bài, tối đa 12 từ), objectives (3 đến ${OUTLINE_LIMITS.maxObjectives} mục tiêu, mỗi mục bắt đầu bằng động từ hành động cụ thể theo thang Bloom như "Trình bày được", "Phân biệt được", "Áp dụng được"; KHÔNG dùng "hiểu", "biết"; chỉ rút từ nội dung tài liệu), sections (các mục).
- Luôn chỉ tạo MỘT bài học, dù tài liệu dài hay ngắn: không tách thành nhiều bài. Tài liệu dài thì thêm mục, không thêm bài. Gán MỌI đoạn của tài liệu vào một mục (trừ lời chào, mục lục, tài liệu tham khảo).
- Mỗi mục có:
  - title: tiêu đề ngắn (tối đa 12 từ). Tài liệu đã có tiêu đề thì giữ ý và số thứ tự của tiêu đề đó.
  - layout: TỰ CHỌN theo đúng quy tắc sau, không có lựa chọn nào khác:
    "image" nếu các đoạn của mục có ảnh ([ẢNH …]);
    "steps" nếu mục là một quy trình gồm các bước theo thứ tự;
    "faq" nếu mục gồm các câu hỏi và câu trả lời (kể cả mục "Tự kiểm tra");
    "text" cho mọi trường hợp còn lại.
  - points: 1 đến 4 ý chính, mỗi ý là một câu ngắn, đầy đủ.
  - boxes: hộp "note" (lưu ý, cảnh báo), "example" (ví dụ), "definition" (định nghĩa) CHỈ khi tài liệu có đoạn tương ứng; không có thì để mảng rỗng.
  - paras: số thứ tự các đoạn tài liệu thuộc mục này. Mỗi đoạn thuộc tối đa MỘT mục. Gán gần như mọi đoạn có nội dung học tập; chỉ để ngoài các đoạn không thuộc bài (lời chào, mục lục, thông tin hành chính, danh mục tài liệu tham khảo). Ảnh ([ẢNH …]) thuộc mục nói về nó.

Trả JSON đúng lược đồ: { lessons: [ { title, objectives, sections: [ { title, layout, points, boxes, paras } ] } ] }.`;

/** Lời nhắc phần tài liệu: mỗi đoạn một dòng, rút gọn đều nếu tài liệu quá dài. */
export function buildSourcePrompt(name: string, paras: SourcePara[], words: number): string {
  const textChars = paras.reduce((n, p) => n + ("t" in p ? p.t.length : 0), 0);
  const perPara = Math.max(
    PREVIEW_MIN_PER_PARA,
    Math.min(PREVIEW_MAX_PER_PARA, Math.floor(PREVIEW_BUDGET_CHARS / Math.max(1, paras.length))),
  );
  const shorten = textChars > PREVIEW_BUDGET_CHARS;
  const lines = paras.map((p, i) => {
    if (!("t" in p)) return `[${i + 1}] [ẢNH${p.alt ? `: ${p.alt}` : ""}]`;
    const t = shorten && p.t.length > perPara ? `${p.t.slice(0, perPara)}…` : p.t;
    return `[${i + 1}] ${t}`;
  });
  const minutes = Math.max(1, Math.round(words / 200));
  return `Tài liệu: ${name}
Khoảng ${words} từ, ước đọc ${minutes} phút, ${paras.length} đoạn.${shorten ? " (Đoạn dài đã được rút gọn, dấu … là phần lược bớt.)" : ""}

${lines.join("\n")}

Lập dàn ý theo các quy tắc ở trên. Trả JSON.`;
}

export interface LessonOutlineInput {
  /** Mẫu bài giảng viên chọn (mặc định "theory"). */
  template?: LessonTemplateKey;
  sourceName: string;
  paras: SourcePara[];
  words: number;
}

export async function generateLessonOutline(
  userId: string,
  input: LessonOutlineInput,
  openai: OpenAI,
  model = DEFAULT_MODEL,
  db: PrismaClient = prisma,
): Promise<RawLessonOutline> {
  const textChars = input.paras.reduce((n, p) => n + ("t" in p ? p.t.length : 0), 0);
  if (textChars < LESSON_OUTLINE_MIN_CHARS) {
    throw new AiGenerationError("validation_failed", "source_too_short");
  }
  await assertWithinCaps(userId, db, "generator");

  const { data, inputTokens, outputTokens } = await callJsonModel<RawLessonOutline>(
    openai,
    model,
    SYSTEM(input.template ?? "theory"),
    buildSourcePrompt(input.sourceName, input.paras, input.words),
    "lesson_outline",
    SCHEMA,
    6000,
  );
  await recordAiUsage(userId, model, inputTokens, outputTokens, db);

  if (!data || !Array.isArray(data.lessons)) {
    throw new AiGenerationError("openai_error", "bad_outline_shape");
  }
  // Lời nhắc đánh số từ 1 cho tự nhiên; dàn ý lưu chỉ số từ 0.
  return {
    lessons: data.lessons.map((l) => ({
      ...l,
      sections: (Array.isArray(l.sections) ? l.sections : []).map((s) => ({
        ...s,
        paras: (Array.isArray(s.paras) ? s.paras : []).map((n) => Number(n) - 1),
      })),
    })),
  };
}
